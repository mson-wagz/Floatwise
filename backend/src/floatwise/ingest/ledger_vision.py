from typing import Any
import cv2
import pytesseract

def process_ledger_image(image_path: str) -> Any:
    """
    Process a ledger image to extract text using OCR.

    Args:
        image_path (str): The path to the ledger image.

    Returns:
        str: Extracted text from the ledger image.
    """
    # Load the image from the specified path
    image = cv2.imread(image_path)

    # Convert the image to grayscale for better OCR results
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Use pytesseract to extract text from the image
    extracted_text = pytesseract.image_to_string(gray_image)

    return extracted_text

def main():
    # Example usage
    image_path = 'path/to/ledger/image.jpg'  # Replace with actual image path
    text = process_ledger_image(image_path)
    print(text)

if __name__ == "__main__":
    main()