"""Upload service for document extraction."""
import os
import io
from pathlib import Path

def extract_text_from_file(file_path: str) -> str:
    """Extract raw text from various file formats."""
    ext = Path(file_path).suffix.lower()
    
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()
    
    elif ext == ".pdf":
        try:
            import pypdf
            text = ""
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f)
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
            return text.strip()
        except Exception:
            return ""

    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception:
            return ""
            
    elif ext in [".png", ".jpg", ".jpeg"]:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            return pytesseract.image_to_string(img).strip()
        except Exception:
            return ""

    return ""
