import numpy as np

def monte_carlo_simulation(initial_cash, e_float, num_simulations, days):
    results = []
    
    for _ in range(num_simulations):
        cash_flow = initial_cash
        daily_results = []
        
        for day in range(days):
            # Simulate daily cash flow changes
            cash_flow += np.random.normal(loc=0, scale=100)  # Random cash flow changes
            cash_flow += e_float  # Add e-float
            
            daily_results.append(cash_flow)
        
        results.append(daily_results)
    
    return np.array(results)

def analyze_results(simulation_results):
    mean_results = np.mean(simulation_results, axis=0)
    std_dev_results = np.std(simulation_results, axis=0)
    
    return mean_results, std_dev_results

def main():
    initial_cash = 1000  # Starting cash
    e_float = 200  # E-float amount
    num_simulations = 1000  # Number of Monte Carlo simulations
    days = 30  # Number of days to simulate
    
    simulation_results = monte_carlo_simulation(initial_cash, e_float, num_simulations, days)
    mean_results, std_dev_results = analyze_results(simulation_results)
    
    print("Mean Cash Flow Over Days:", mean_results)
    print("Standard Deviation of Cash Flow Over Days:", std_dev_results)

if __name__ == "__main__":
    main()