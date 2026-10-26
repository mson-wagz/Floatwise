from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RestockCosts:
    """ILLUSTRATIVE restocking costs in KSh. Let the agent edit these in the app."""
    cash_fixed_ksh: float = 500.0     # trip to the bank or a super-agent
    cash_per_unit_ksh: float = 1.0    # per KSh 1,000 moved
    float_fixed_ksh: float = 150.0
    float_per_unit_ksh: float = 2.0   # float purchase fee per KSh 1,000

    def cost(self, added_cash_units, added_float_units):
        c = np.where(added_cash_units > 0,
                     self.cash_fixed_ksh + self.cash_per_unit_ksh * added_cash_units, 0.0)
        f = np.where(added_float_units > 0,
                     self.float_fixed_ksh + self.float_per_unit_ksh * added_float_units, 0.0)
        return c + f