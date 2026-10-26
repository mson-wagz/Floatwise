"""Money rules shared by the data generator and the model.

The tiers are ILLUSTRATIVE, not Safaricom's real tariff. Replace with real values.
"""

_TIERS = [(100, 0), (500, 5), (1000, 10), (2500, 25), (5000, 45),
          (10000, 80), (20000, 130), (50000, 200)]


def commission_ksh(amount_ksh: int, is_withdrawal: bool = True) -> int:
    fee = next((f for upper, f in _TIERS if amount_ksh <= upper), 250)
    return fee if is_withdrawal else int(fee * 0.4)