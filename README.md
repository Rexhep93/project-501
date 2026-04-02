# Voetbal 501

Een voetbal-quizspel gebaseerd op darts 501-scoring met echte spelerstatistieken.

## Data opbouwen (eenmalig)

### Stappen

1. Open een **Codespace** vanuit deze repo (groene "Code" knop → Codespaces → Create)
2. Stel je Kaggle credentials in (vind je op kaggle.com → Settings → API → Create New Token):
   ```
   export KAGGLE_USERNAME="jouw_username"
   export KAGGLE_KEY="jouw_key"
   ```
3. Installeer dependencies en draai het script:
   ```
   pip install kagglehub pandas
   python scripts/build_db.py
   ```
4. Het script download automatisch de dataset en maakt `data/game_data.json`
5. Commit en push:
   ```
   git add data/game_data.json
   git commit -m "Add game data"
   git push
   ```

## Projectstructuur

```
voetbal-501/
├── data/
│   └── game_data.json    ← Verwerkte game-data
├── scripts/
│   └── build_db.py       ← Download + verwerk Kaggle data
├── app/                  ← PWA (komt later)
├── .gitignore
└── README.md
```
