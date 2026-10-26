def optimize_restock_policy(current_stock, demand_forecast, lead_time, service_level):
    """
    Optimize the restock policy based on current stock, demand forecast, lead time, and desired service level.

    Parameters:
    - current_stock (int): The current stock level of the item.
    - demand_forecast (list of int): A list of expected demand for the upcoming periods.
    - lead_time (int): The lead time in periods for restocking the item.
    - service_level (float): The desired service level (between 0 and 1).

    Returns:
    - restock_quantity (int): The optimal quantity to restock.
    """
    # Calculate the average demand during the lead time
    average_demand = sum(demand_forecast) / len(demand_forecast)
    demand_during_lead_time = average_demand * lead_time

    # Calculate the safety stock based on the service level
    safety_stock = calculate_safety_stock(demand_forecast, service_level)

    # Calculate the optimal restock quantity
    restock_quantity = max(0, demand_during_lead_time + safety_stock - current_stock)

    return restock_quantity

def calculate_safety_stock(demand_forecast, service_level):
    """
    Calculate the safety stock based on demand variability and desired service level.

    Parameters:
    - demand_forecast (list of int): A list of expected demand for the upcoming periods.
    - service_level (float): The desired service level (between 0 and 1).

    Returns:
    - safety_stock (int): The calculated safety stock.
    """
    # Calculate the standard deviation of the demand forecast
    mean_demand = sum(demand_forecast) / len(demand_forecast)
    variance = sum((x - mean_demand) ** 2 for x in demand_forecast) / len(demand_forecast)
    std_dev = variance ** 0.5

    # Z-score for the desired service level (assuming normal distribution)
    z_score = get_z_score(service_level)

    # Calculate safety stock
    safety_stock = z_score * std_dev

    return int(safety_stock)

def get_z_score(service_level):
    """
    Get the Z-score corresponding to the desired service level.

    Parameters:
    - service_level (float): The desired service level (between 0 and 1).

    Returns:
    - z_score (float): The Z-score corresponding to the service level.
    """
    # Z-scores for common service levels
    z_scores = {
        0.90: 1.28,
        0.95: 1.65,
        0.99: 2.33
    }
    return z_scores.get(service_level, 1.65)  # Default to 95% service level if not found