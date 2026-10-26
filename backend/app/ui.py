import streamlit as st

def main():
    st.title("Floatwise Chat Interface")
    st.write("Welcome to the Floatwise application! How can we assist you today?")

    user_input = st.text_input("You:", "")
    
    if st.button("Send"):
        if user_input:
            # Here you would typically call your backend API to process the input
            response = "This is a placeholder response."  # Replace with actual response logic
            st.write(f"Floatwise: {response}")
        else:
            st.warning("Please enter a message before sending.")

if __name__ == "__main__":
    main()