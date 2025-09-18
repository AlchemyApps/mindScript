# Platform Configuration for Background Audio & CarPlay/Android Auto

## iOS Configuration (Info.plist)

Add the following configurations to your `ios/[YourAppName]/Info.plist`:

### Background Modes

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

### Audio Session Configuration

```xml
<key>UIRequiredDeviceCapabilities</key>
<array>
  <string>audio</string>
</array>
```

### CarPlay Support

```xml
<key>UIApplicationSceneManifest</key>
<dict>
  <key>UISceneConfigurations</key>
  <dict>
    <key>CPTemplateApplicationSceneSessionRoleApplication</key>
    <array>
      <dict>
        <key>UISceneClassName</key>
        <string>CPTemplateApplicationScene</string>
        <key>UISceneConfigurationName</key>
        <string>CarPlay Configuration</string>
        <key>UISceneDelegateClassName</key>
        <string>CarPlaySceneDelegate</string>
      </dict>
    </array>
  </dict>
</dict>
```

### CarPlay Entitlements

You'll need to add the CarPlay entitlement to your app. This requires:

1. Enable CarPlay in your app's capabilities in Xcode
2. Request CarPlay entitlement from Apple Developer portal
3. Add to `Entitlements.plist`:

```xml
<key>com.apple.developer.carplay-audio</key>
<true/>
```

## Android Configuration

### AndroidManifest.xml

Add the following to `android/app/src/main/AndroidManifest.xml`:

#### Permissions

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

#### Service Declaration

Inside the `<application>` tag:

```xml
<service
  android:name="com.doublesymmetry.trackplayer.service.MusicService"
  android:foregroundServiceType="mediaPlayback"
  android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.MEDIA_BUTTON" />
  </intent-filter>
</service>

<receiver
  android:name="com.doublesymmetry.trackplayer.receivers.MediaButtonReceiver"
  android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.MEDIA_BUTTON" />
  </intent-filter>
</receiver>
```

#### Android Auto Support

```xml
<meta-data
  android:name="com.google.android.gms.car.application"
  android:resource="@xml/automotive_app_desc" />

<service
  android:name=".MediaBrowserService"
  android:exported="true">
  <intent-filter>
    <action android:name="android.media.browse.MediaBrowserService" />
  </intent-filter>
</service>
```

### automotive_app_desc.xml

Create `android/app/src/main/res/xml/automotive_app_desc.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
  <uses name="media" />
</automotiveApp>
```

### build.gradle

In `android/app/build.gradle`, ensure minimum SDK versions:

```gradle
android {
    compileSdkVersion 33

    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 33
    }
}
```

## Expo Configuration (app.json / app.config.js)

If using Expo managed workflow, add to `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio", "fetch", "remote-notification"],
        "UIRequiredDeviceCapabilities": ["audio"]
      }
    },
    "android": {
      "permissions": [
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "WAKE_LOCK",
        "BLUETOOTH",
        "BLUETOOTH_CONNECT"
      ]
    },
    "plugins": [
      [
        "react-native-track-player",
        {
          "iosAppInBackground": true,
          "androidAppInBackground": true
        }
      ]
    ]
  }
}
```

## Testing

### iOS Testing

1. **Background Audio**:
   - Play audio and press home button
   - Audio should continue playing
   - Lock screen controls should be visible

2. **CarPlay Simulator**:
   - In Xcode, go to Hardware > External Displays > CarPlay
   - Test navigation and playback

### Android Testing

1. **Background Audio**:
   - Play audio and navigate away
   - Notification with controls should appear
   - Audio continues in background

2. **Android Auto Testing**:
   - Use Desktop Head Unit (DHU) from Android SDK
   - Connect device via ADB
   - Test media browser and playback

## Troubleshooting

### iOS Issues

- **No audio in background**: Check UIBackgroundModes includes "audio"
- **CarPlay not appearing**: Verify entitlements and provisioning profile
- **Audio interruptions**: Check AVAudioSession category settings

### Android Issues

- **Service killed**: Ensure foreground service is properly configured
- **No media controls**: Check MediaSession implementation
- **Android Auto not detecting**: Verify automotive_app_desc.xml is present

## Additional Resources

- [React Native Track Player Docs](https://react-native-track-player.js.org/)
- [Apple CarPlay Programming Guide](https://developer.apple.com/carplay/)
- [Android Auto for Media Apps](https://developer.android.com/training/cars/media)