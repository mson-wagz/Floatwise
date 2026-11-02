from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RestockCosts:
    """ILLUSTRATIVE costs in KSh. Let the agent edit these in the app."""
    cash_fixed_ksh: float = 500.0     # trip to the bank or a super-agent for cash
    cash_per_unit_ksh: float = 1.0    # per KSh 1,000 moved
    float_fixed_ksh: float = 150.0
    float_per_unit_ksh: float = 2.0   # float purchase fee per KSh 1,000
    bank_fixed_ksh: float = 300.0     # trip to pay excess cash or float into the bank
    bank_per_unit_ksh: float = 0.0

    def cost(self, added_cash_units, added_float_units):
        c = np.asarray(added_cash_units)
        f = np.asarray(added_float_units)
        add_cash = np.where(c > 0, self.cash_fixed_ksh + self.cash_per_unit_ksh * c, 0.0)
        add_float = np.where(f > 0, self.float_fixed_ksh + self.float_per_unit_ksh * f, 0.0)
        banked = np.maximum(-c, 0) + np.maximum(-f, 0)
        bank = np.where(banked > 0, self.bank_fixed_ksh + self.bank_per_unit_ksh * banked, 0.0)
        return add_cash + add_float + bank