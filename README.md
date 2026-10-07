# FitTrack (iOS)

An iPhone app for tracking your fitness goals, built with Expo / React Native. All data stays on your phone.

## Features

- **Calorie calculator**: BMR (Mifflin-St Jeor), maintenance calories, a daily target for losing, maintaining or gaining, protein/carb/fat targets, BMI, and the number of weeks to your target weight.
- **Calorie intake**: log food by meal with macros and servings. Foods you've logged before show up as one-tap suggestions.
- **Step counter**: reads the iPhone's built-in motion chip, so steps are counted **all day, even when the app is closed**. It keeps 7 days of history, and you can add steps by hand, for example from a treadmill.
- **Water**: one-tap glasses, custom amounts, undo, and a daily goal.
- **Supplements**: set up your stack with doses and times, then tick them off each day. Late ones are highlighted.
- **Reminders** (iOS notifications) for drinking water, moving, and taking each supplement at its set time. They only fire during your active hours and skip anything you've already done today.
- **Progress**: 7-day charts for calories, steps and water, plus a weight log with a trend line toward your target.
- Light and dark mode, haptic feedback, and backup/restore.

## Run it on your iPhone (free, no Mac needed)

1. On your iPhone, install **Expo Go** from the App Store.
2. On any computer (Windows, Mac or Linux), install [Node.js](https://nodejs.org) (LTS), then run:
   ```bash
   git clone https://github.com/moritzherb/Claude.git
   cd Claude
   npm install
   npx expo start
   ```
3. Scan the QR code in the terminal with the iPhone **Camera** app. FitTrack opens in Expo Go.
   - The phone and computer need to be on the same Wi-Fi. If that doesn't work, use `npx expo start --tunnel`.
4. Allow **Motion & Fitness** (for steps) and **Notifications** (for reminders) when asked.

## Install it as a real app (home screen icon, no computer needed afterwards)

This needs an [Apple Developer account](https://developer.apple.com/programs/) (99 USD/year) and a free [Expo account](https://expo.dev/signup). No Mac is needed, because the build runs in Expo's cloud.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios      # answer "yes" to let EAS handle certificates
npx eas-cli@latest submit --platform ios     # uploads to TestFlight
```

Then install **TestFlight** on your iPhone and install FitTrack from there. The same build can later go to the App Store.

## Development

```bash
npx tsc --noEmit     # typecheck
npx expo start       # dev server
```

Code layout: `App.tsx` (header and tabs), `src/screens/*` (one file per tab), `src/store.tsx` (data, persistence and the calorie maths), `src/steps.ts` (pedometer sync), `src/reminders.ts` (notification planning).

## Notes

- Reminders are scheduled up to 3 days ahead, which is the most iOS allows (64 pending notifications). Opening the app tops them up.
- Move reminders fire at a fixed interval during your active hours. iOS doesn't let apps check your step count in the background.
