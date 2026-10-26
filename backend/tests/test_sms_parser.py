import pytest
from floatwise.ingest.sms_parser import parse_sms

def test_parse_sms_valid():
    sms = "Buy 10 apples for KSh 200"
    expected_output = {
        "action": "buy",
        "quantity": 10,
        "item": "apples",
        "price": 200
    }
    assert parse_sms(sms) == expected_output

def test_parse_sms_invalid():
    sms = "Invalid message format"
    expected_output = None
    assert parse_sms(sms) == expected_output

def test_parse_sms_edge_case():
    sms = "Buy 1 banana for KSh 50"
    expected_output = {
        "action": "buy",
        "quantity": 1,
        "item": "banana",
        "price": 50
    }
    assert parse_sms(sms) == expected_output

def test_parse_sms_no_quantity():
    sms = "Buy apples for KSh 200"
    expected_output = {
        "action": "buy",
        "quantity": 1,
        "item": "apples",
        "price": 200
    }
    assert parse_sms(sms) == expected_output

def test_parse_sms_no_price():
    sms = "Buy 10 oranges"
    expected_output = {
        "action": "buy",
        "quantity": 10,
        "item": "oranges",
        "price": None
    }
    assert parse_sms(sms) == expected_output