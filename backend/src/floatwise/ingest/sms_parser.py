import re

def parse_sms(sms_text):
    """
    Parses the SMS text to extract relevant information.
    
    Args:
        sms_text (str): The SMS message to parse.
        
    Returns:
        dict: A dictionary containing extracted information.
    """
    # Example regex patterns for extracting information
    patterns = {
        'amount': r'(?i)\b(?:amount|total)\s*[:=]\s*\$?(\d+\.?\d*)\b',
        'date': r'(?i)\b(?:date|on)\s*[:=]\s*(\d{1,2}/\d{1,2}/\d{2,4})\b',
        'transaction_id': r'(?i)\b(?:transaction|id)\s*[:=]\s*(\w+)\b'
    }
    
    extracted_data = {}
    
    for key, pattern in patterns.items():
        match = re.search(pattern, sms_text)
        if match:
            extracted_data[key] = match.group(1)
    
    return extracted_data

def main():
    # Example SMS for testing
    sms_example = "Your transaction of $150 on 12/05/2023 has been completed. Transaction ID: ABC123."
    parsed_data = parse_sms(sms_example)
    print(parsed_data)

if __name__ == "__main__":
    main()