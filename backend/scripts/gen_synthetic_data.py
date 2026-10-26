import random
import json
import os

def generate_synthetic_data(num_samples=100):
    synthetic_data = []
    
    for _ in range(num_samples):
        sample = {
            "transaction_id": random.randint(1000, 9999),
            "shop_id": random.randint(1, 50),
            "amount": round(random.uniform(1.0, 100.0), 2),
            "timestamp": random.randint(1609459200, 1640995200),  # Timestamps for 2021
            "payment_method": random.choice(["cash", "mobile_money", "credit_card"]),
            "customer_id": random.randint(1, 100)
        }
        synthetic_data.append(sample)
    
    return synthetic_data

def save_synthetic_data(data, output_file='data/synthetic/synthetic_data.json'):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=4)

if __name__ == "__main__":
    num_samples = 100  # You can change this to generate more or fewer samples
    synthetic_data = generate_synthetic_data(num_samples)
    save_synthetic_data(synthetic_data)