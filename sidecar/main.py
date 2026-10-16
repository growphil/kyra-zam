from fastapi import FastAPI, UploadFile, File, Form
from processor import process_report
import json

app = FastAPI(title="KYRA ZAM AH/IR Sidecar")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/process-report")
async def process_machine_report(
    file: UploadFile = File(...),
    db_serials: str = Form("")      # Explicitly mark as Form field
):
    print(f"DEBUG: Received db_serials (raw): {db_serials[:100]}...")
    
    contents = await file.read()
    try:
        known_serials = json.loads(db_serials) if db_serials else []
    except Exception as e:
        print(f"DEBUG: JSON Parse Error: {e}")
        known_serials = []
    
    print(f"DEBUG: Parsed {len(known_serials)} serials from request")
    results = process_report(contents, file.filename, known_serials)
    return results

@app.post("/form-groups")
async def form_groups(
    payload: dict
):
    cells = payload.get("cells", [])
    pack_size = payload.get("packSize", 16)
    ah_variation = payload.get("ahVariation", 1.0)
    ir_variation = payload.get("irVariation", 3.0)
    
    from processor import form_pax_groups
    results = form_pax_groups(cells, pack_size, ah_variation, ir_variation)
    return results
