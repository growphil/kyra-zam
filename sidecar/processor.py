import pandas as pd
import re
from thefuzz import fuzz, process
from io import BytesIO
import math
from qc_rules import calculate_grade, evaluate_qc_cell

def normalize_for_match(s: str) -> str:
    """Removes all non-alphanumeric characters, converts to uppercase, and ensures KZ-RAW- prefix if it looks like a RAW serial."""
    val = re.sub(r'[^A-Z0-9]', '', str(s).upper())
    if val.startswith("RAW"):
        return f"KZ-{val}"
    if val.startswith("KZRAW"):
        return val.replace("KZRAW", "KZ-RAW-")
    # If it's a numeric string that might be a raw serial suffix
    if val.isdigit() and len(val) >= 3:
         return f"KZ-RAW-{val}"
    return val

def process_report(file_bytes: bytes, filename: str, known_serials: list) -> dict:
    print(f"DEBUG: Processing {filename} with {len(known_serials)} known serials")
    
    # 1. Read file — CSV or Excel
    if filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(file_bytes))
    else:
        df = pd.read_excel(BytesIO(file_bytes))

    # 2. Normalize column headers
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # 3. Auto-detect serial / AH / IR columns
    serial_col = next((c for c in df.columns if any(k in c for k in ["serial","sn","barcode","id"])), df.columns[0])
    ah_col     = next((c for c in df.columns if any(k in c for k in ["ah","capacity","cap"])), None)
    ir_col     = next((c for c in df.columns if any(k in c for k in ["ir","resistance","mohm","dcir"])), None)

    matched, review, unmatched = [], [], []
    
    # Pre-normalize known serials for better lookup
    norm_known_map = {normalize_for_match(s): s for s in known_serials}
    norm_known_list = list(norm_known_map.keys())

    for _, row in df.iterrows():
        raw_serial_str = str(row[serial_col]).strip()
        norm_serial = normalize_for_match(raw_serial_str)
        
        ah = float(row[ah_col]) if ah_col and pd.notna(row.get(ah_col)) else None
        ir = float(row[ir_col]) if ir_col and pd.notna(row.get(ir_col)) else None

        if not norm_known_list:
            unmatched.append({"serial_from_file": raw_serial_str, "ah_value": ah, "ir_value": ir, "status": "unmatched"})
            continue

        # 1. Try Exact Match
        if norm_serial in norm_known_map:
            best_match_original = norm_known_map[norm_serial]
            score = 100
        else:
            # 2. Fuzzy Match as fallback
            res = process.extractOne(norm_serial, norm_known_list, scorer=fuzz.WRatio)
            if res:
                best_match_norm, score = res
                best_match_original = norm_known_map[best_match_norm]
            else:
                score = 0
                best_match_original = None
        
        entry = {
            "serial_from_file": raw_serial_str, 
            "normalized_serial": norm_serial,
            "matched_db_serial": best_match_original,
            "confidence": score, 
            "ah_value": ah, 
            "ir_value": ir,
            "grade": calculate_grade(ah, ir)
        }

        # Stage 1 Rules: >= 95 Auto, 90-94 Manual Review, < 90 Unmatched
        if score >= 95:
            matched.append({**entry, "status": "matched"})
        elif score >= 90:
            review.append({**entry, "status": "review"})
        else:
            unmatched.append({**entry, "status": "unmatched"})

    print(f"DEBUG: Matching complete. M:{len(matched)} R:{len(review)} U:{len(unmatched)}")
    return {"matched": matched, "review": review, "unmatched": unmatched,
            "summary": {"total": len(df), "matched": len(matched),
                        "review": len(review), "unmatched": len(unmatched)}}

def form_pax_groups(cells: list, pack_size: int, ah_variation: float = 0.05, ir_variation: float = 3.0) -> dict:
    """
    Intelligent Cell Matching & Grouping Engine.
    Groups cells into balanced PAX packs based on GRADE, AH and IR similarity.
    """
    print(f"DEBUG: Forming PAX groups for {len(cells)} cells, pack_size={pack_size}")
    
    # 1. Initial Filtering & Sorting
    # Only keep cells that have both AH, IR and are not REJECTED
    valid_cells = [c for c in cells if c.get('ahValue') is not None and c.get('irValue') is not None and c.get('grade') != 'REJECT']
    
    # Group cells by grade first
    grade_bins = {}
    for c in valid_cells:
        g = c.get('grade', 'C')
        if g not in grade_bins: grade_bins[g] = []
        grade_bins[g].append(c)

    pax_packs = []
    loose_cells = []

    for grade, grade_cells in grade_bins.items():
        # Sort by AH primary, IR secondary
        grade_cells.sort(key=lambda x: (x['ahValue'], x['irValue']))
        
        remaining_cells = grade_cells.copy()
        rejected_in_grade = []

        # 2. Greedy Binning Algorithm per Grade
        while len(remaining_cells) >= pack_size:
            # Start with the lowest AH cell as anchor
            anchor = remaining_cells[0]
            
            # Look for candidates within variations
            candidates = [
                c for c in remaining_cells 
                if abs(c['ahValue'] - anchor['ahValue']) <= ah_variation
            ]
            
            if len(candidates) >= pack_size:
                # Within AH candidates, find those with closest IR to anchor
                candidates.sort(key=lambda x: abs(x['irValue'] - anchor['irValue']))
                
                # Select top N candidates
                pack_candidates = candidates[:pack_size]
                
                # Final check for IR variation
                ir_values = [c['irValue'] for c in pack_candidates]
                ir_min, ir_max = min(ir_values), max(ir_values)
                
                if (ir_max - ir_min) <= ir_variation:
                    pax_packs.append({
                        "id": f"SUGGESTED-{grade}-{len([p for p in pax_packs if grade in p['id']]) + 1}",
                        "cells": pack_candidates,
                        "grade": grade,
                        "avgAh": sum(c['ahValue'] for c in pack_candidates) / pack_size,
                        "avgIr": sum(c['irValue'] for c in pack_candidates) / pack_size,
                        "ahSpread": max(c['ahValue'] for c in pack_candidates) - min(c['ahValue'] for c in pack_candidates),
                        "irSpread": ir_max - ir_min
                    })
                    ids_to_remove = [c['serialNumber'] for c in pack_candidates]
                    remaining_cells = [c for c in remaining_cells if c['serialNumber'] not in ids_to_remove]
                else:
                    rejected_in_grade.append(remaining_cells.pop(0))
            else:
                rejected_in_grade.append(remaining_cells.pop(0))
        
        loose_cells.extend(remaining_cells + rejected_in_grade)

    return {
        "packs": pax_packs,
        "looseCells": loose_cells,
        "summary": {
            "totalPacks": len(pax_packs),
            "totalCellsGrouped": len(pax_packs) * pack_size,
            "looseCount": len(loose_cells)
        }
    }
