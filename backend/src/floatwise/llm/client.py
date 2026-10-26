import requests
import os

class MetaAPIClient:
    def __init__(self):
        self.api_key = os.getenv("META_API_KEY")
        self.base_url = "https://api.meta.com/v1"  # Replace with the actual base URL

    def _make_request(self, endpoint, method='GET', data=None):
        url = f"{self.base_url}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        response = requests.request(method, url, headers=headers, json=data)
        
        if response.status_code != 200:
            raise Exception(f"API request failed with status {response.status_code}: {response.text}")
        
        return response.json()

    def get_data(self, endpoint):
        return self._make_request(endpoint, method='GET')

    def post_data(self, endpoint, data):
        return self._make_request(endpoint, method='POST', data=data)