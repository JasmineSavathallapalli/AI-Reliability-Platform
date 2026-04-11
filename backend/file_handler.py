# file_handler.py - Handles file uploads and content extraction

import cloudinary
import cloudinary.uploader
import PyPDF2
import io
import os
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def upload_file(file_bytes, filename, resource_type="auto"):
    """Upload file to Cloudinary and return URL."""
    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=filename,
        resource_type=resource_type
    )
    return result["secure_url"]


def extract_pdf_text(file_bytes):
    """Extract text from PDF file."""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text[:4000]  # Limit to 4000 chars for LLM context
    except Exception as e:
        return f"Could not extract PDF text: {e}"


def get_file_context(file_bytes, filename, mime_type):
    """
    Process uploaded file and return context for LLM.
    Returns: {"type": "pdf/image/text", "content": "...", "url": "..."}
    """
    ext = filename.lower().split(".")[-1]

    # PDF
    if ext == "pdf" or mime_type == "application/pdf":
        text = extract_pdf_text(file_bytes)
        url = upload_file(file_bytes, filename)
        return {
            "type": "pdf",
            "content": f"[PDF Document: {filename}]\n{text}",
            "url": url,
            "filename": filename
        }

    # Images
    elif ext in ["jpg", "jpeg", "png", "gif", "webp"] or mime_type.startswith("image/"):
        url = upload_file(file_bytes, filename, resource_type="image")
        return {
            "type": "image",
            "content": f"[Image uploaded: {filename}]",
            "url": url,
            "filename": filename
        }

    # Text files
    elif ext in ["txt", "csv", "md", "json"]:
        text = file_bytes.decode("utf-8", errors="ignore")[:4000]
        url = upload_file(file_bytes, filename)
        return {
            "type": "text",
            "content": f"[Text File: {filename}]\n{text}",
            "url": url,
            "filename": filename
        }

    else:
        return {
            "type": "unsupported",
            "content": f"[Unsupported file type: {filename}]",
            "url": None,
            "filename": filename
        }