from hashlib import sha256

def anonymize_data(data):
    """
    Anonymizes sensitive information in the provided data.

    Args:
        data (dict): A dictionary containing sensitive information such as
                     'phone_number' and 'name'.

    Returns:
        dict: A new dictionary with anonymized values.
    """
    anonymized_data = data.copy()
    
    if 'phone_number' in anonymized_data:
        anonymized_data['phone_number'] = sha256(anonymized_data['phone_number'].encode()).hexdigest()
    
    if 'name' in anonymized_data:
        anonymized_data['name'] = sha256(anonymized_data['name'].encode()).hexdigest()
    
    return anonymized_data

# Example usage
if __name__ == "__main__":
    sample_data = {
        'phone_number': '1234567890',
        'name': 'John Doe'
    }
    
    anonymized = anonymize_data(sample_data)
    print(anonymized)  # Output will show hashed values for phone_number and name