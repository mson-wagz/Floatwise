# Floatwise Project

## Overview
Floatwise is a data-driven application designed to analyze and optimize financial transactions and inventory management. It leverages machine learning and natural language processing to provide insights and automate decision-making processes.

## Setup Instructions
1. **Clone the repository**:
   ```
   git clone https://github.com/yourusername/floatwise.git
   cd floatwise
   ```

2. **Create a virtual environment**:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**:
   ```
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   Copy the `.env.example` to `.env` and fill in the required values:
   ```
   cp .env.example .env
   ```

## Usage Guidelines
- **Generating Synthetic Data**: Use the script located in `scripts/gen_synthetic_data.py` to generate synthetic datasets for testing.
- **Running the API**: Start the FastAPI application by running:
   ```
   uvicorn src/floatwise/api/main.py:app --reload
   ```
- **Interacting with the UI**: Launch the Streamlit front end by executing:
   ```
   streamlit run app/ui.py
   ```

## Directory Structure
- `data/`: Contains example and synthetic data files.
- `scripts/`: Scripts for data generation and processing.
- `src/floatwise/`: Core application code, including configuration, data models, and API.
- `app/`: User interface components.
- `tests/`: Unit tests for various functionalities.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.