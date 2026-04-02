"""
data_pipeline/scripts/weekly_refresh.py

Wekelijkse refresh van het huidige seizoen via API-Football.
Bedoeld als cron job: elke maandag 06:00.

Cron instelling:
    0 6 * * 1 /usr/bin/python3 /path/to/football501/data_pipeline/scripts/weekly_refresh.py

Of via GitHub Actions (gratis, geen server nodig):
    Zie .github/workflows/weekly_refresh.yml
"""

import sys
import os
import logging
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from data_pipeline.loaders.api_football_loader import run_weekly_refresh, CURRENT_SEASON

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            f"refresh_{datetime.now().strftime('%Y%m%d')}.log"
        ),
    ]
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("⏰ Wekelijkse refresh gestart")
    run_weekly_refresh(season=CURRENT_SEASON)
    logger.info("✅ Refresh klaar")
