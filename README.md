# FitTrack

A mobile-first fitness tracker that runs in the browser and can be installed to your home screen (PWA). No account, no server: all data stays on your device (localStorage), with JSON export/import for backups.

## Features

- **Calorie calculator**: BMR (Mifflin-St Jeor), maintenance calories, a daily target for losing, maintaining or gaining weight, protein/carb/fat targets, BMI, and how many weeks until you reach your target weight.
- **Calorie intake**: log food by meal with optional macros and servings. Foods you've logged before autocomplete.
- **Step counter**: counts steps with the phone's accelerometer while the app is open (sensitivity is adjustable). You can also add steps or set a total by hand, for example from Apple Health or Google Fit.
- **Water tracking**: one-tap glasses, custom amounts, undo, and a daily goal.
- **Supplements**: set up your stack with doses and times, then tick them off each day. Missed ones are highlighted.
- **Reminders**: drink water every N minutes, move if you've been inactive, and take each supplement at its set time. They only fire during your active hours.
- **Progress**: 7-day charts for calories, steps and water, plus a weight log with a trend line toward your target.
- History: browse any past day with the ‹ › arrows.

## Run it

Any static file server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To use it on your phone, host the folder over **HTTPS** (for example with GitHub Pages: Settings → Pages → deploy from branch). Open it, then use "Add to Home Screen". HTTPS is required for motion sensors, notifications and offline mode.

## Limitations

- Web apps can't count steps in the background. The built-in counter works only while the app is open; for all-day counts, copy the total from your phone's health app.
- Reminders fire while the app is open or still running in the background. Mobile OSes may pause a closed web app, so treat reminders as best-effort. On iPhone, notifications need iOS 16.4+ and the app added to the Home Screen.
