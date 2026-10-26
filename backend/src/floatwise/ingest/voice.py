from typing import List
import speech_recognition as sr

def transcribe_audio(file_path: str) -> str:
    """Transcribe audio from a given file using Google Web Speech API."""
    recognizer = sr.Recognizer()
    with sr.AudioFile(file_path) as source:
        audio = recognizer.record(source)  # read the entire audio file
    try:
        # Using Google Web Speech API for transcription
        transcription = recognizer.recognize_google(audio)
        return transcription
    except sr.UnknownValueError:
        return "Audio not understood"
    except sr.RequestError as e:
        return f"Could not request results from Google Speech Recognition service; {e}"

def extract_information(transcription: str) -> dict:
    """Extract relevant information from the transcription."""
    # Placeholder for actual extraction logic
    # This could involve NLP techniques to parse the transcription
    extracted_data = {
        "keywords": [],
        "summary": transcription[:50]  # Example: first 50 characters as summary
    }
    return extracted_data

def process_voice_file(file_path: str) -> dict:
    """Process the voice file to transcribe and extract information."""
    transcription = transcribe_audio(file_path)
    extracted_info = extract_information(transcription)
    return {
        "transcription": transcription,
        "extracted_info": extracted_info
    }