from typing import List, Dict

def analyze_stockouts(data: List[Dict], stock_threshold: float) -> float:
    """
    Analyzes past transaction data to assess the cost of stockouts.

    Parameters:
    - data: A list of transaction records, where each record is a dictionary containing
             'transaction_amount', 'stock_level', and 'date'.
    - stock_threshold: The stock level below which a stockout is considered to occur.

    Returns:
    - The total cost of stockouts in KSh.
    """
    total_cost = 0.0

    for record in data:
        if record['stock_level'] < stock_threshold:
            total_cost += record['transaction_amount']

    return total_cost

def load_data(file_path: str) -> List[Dict]:
    """
    Loads transaction data from a specified file.

    Parameters:
    - file_path: The path to the data file.

    Returns:
    - A list of transaction records.
    """
    import json

    with open(file_path, 'r') as file:
        return json.load(file)

def main():
    # Example usage
    data = load_data('path/to/transaction_data.json')
    stock_threshold = 10.0  # Example threshold
    cost_of_stockouts = analyze_stockouts(data, stock_threshold)
    print(f"Total cost of stockouts: {cost_of_stockouts} KSh")

if __name__ == "__main__":
    main()