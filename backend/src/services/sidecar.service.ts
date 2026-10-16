import axios from "axios";
import FormData from "form-data";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8001";

export async function processReportWithSidecar(fileBuffer: Buffer, fileName: string, dbSerials: string[]) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename: fileName });
  form.append("db_serials", JSON.stringify(dbSerials));

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await axios.post(`${SIDECAR_URL}/process-report`, form, {
        headers: {
          ...form.getHeaders(),
        },
      });
      return response.data;
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      // Wait 2s before retry on connection errors
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        console.log(`Sidecar not ready, retrying... (${attempt}/${maxRetries})`);
        await new Promise(res => setTimeout(res, 2000));
      } else {
        throw error;
      }
    }
  }
}

export async function recommendPaxGroups(cells: any[], packSize: number, ahVariation: number, irVariation: number) {
  try {
    const response = await axios.post(`${SIDECAR_URL}/form-groups`, {
      cells,
      packSize,
      ahVariation,
      irVariation
    });
    return response.data;
  } catch (error) {
    console.error("Sidecar grouping error:", error);
    throw error;
  }
}
