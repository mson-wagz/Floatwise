from typing import List
import numpy as np
import pandas as pd

class DemandModel:
    def __init__(self, historical_data: pd.DataFrame):
        self.historical_data = historical_data

    def fit(self):
        # Fit the model to historical data
        self.daily_average = self.historical_data['demand'].mean()
        self.std_dev = self.historical_data['demand'].std()

    def predict(self, days: int) -> List[float]:
        # Predict demand for the next 'days' days using a normal distribution
        predictions = np.random.normal(self.daily_average, self.std_dev, days)
        return predictions.tolist()

    def adjust_for_payday(self, predictions: List[float], payday_indices: List[int]) -> List[float]:
        # Increase demand predictions on payday
        for index in payday_indices:
            if index < len(predictions):
                predictions[index] *= 1.2  # Increase by 20% on payday
        return predictions

    def adjust_for_market_day(self, predictions: List[float], market_day_indices: List[int]) -> List[float]:
        # Increase demand predictions on market days
        for index in market_day_indices:
            if index < len(predictions):
                predictions[index] *= 1.15  # Increase by 15% on market day
        return predictions

    def simulate_demand(self, days: int, payday_indices: List[int], market_day_indices: List[int]) -> List[float]:
        self.fit()
        predictions = self.predict(days)
        predictions = self.adjust_for_payday(predictions, payday_indices)
        predictions = self.adjust_for_market_day(predictions, market_day_indices)
        return predictions