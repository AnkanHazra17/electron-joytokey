# Flutter JoyToKey — Production-Ready Implementation Guide

## 1. What This App Does

**electron-joytokey** reads raw HID input from a gamepad (specifically the WhizToys BLE 3×3 grid), evaluates mapping rules (button press/release/hold, axis threshold, hat direction), and injects keyboard strokes into the OS via a native bridge. It supports multiple named profiles, per-app profile auto-switching, a visual grid editor, system tray, global hotkey, and auto-updates.

---

## 2. Tech Stack Decisions

| Concern | Electron Choice | Flutter Choice | Rationale |
|---|---|---|---|
| HID reading | `node-hid` | Custom FFI plugin wrapping `hidapi.dll` | No pub.dev HID package; direct FFI to Win32 HID API |
| Keyboard injection | `cgkey.ps1` (PowerShell) | `dart:ffi` → `SendInput` Win32 API | Eliminates process-spawn overhead; synchronous |
| State management | Zustand | **Riverpod** | Fine-grained reactivity, code-gen, testable |
| Persistence | `electron-store` (JSON) | **JSON file with atomic writes** | Simple, portable, no schema migration needed |
| Serialization | Manual interfaces | **freezed + json_serializable** | Immutable models, copyWith, JSON for free |
| UI navigation | Manual tabs | **go_router** | Deep links, typed routes, nested navigation |
| System tray | `electron.Tray` | **tray_manager** | Mature package, cross-platform |
| Window control | `BrowserWindow` | **window_manager** | Title bar, drag region, minimize-to-tray |
| Global hotkey | `globalShortcut` | **hotkey_manager** | Wraps platform global shortcuts |
| Auto-update | `electron-updater` | **auto_updater** | Supports GitHub Releases |
| Active window | `active-win` | Custom FFI → `GetForegroundWindow` | Lightweight, no spawned process |
| File dialogs | Electron `dialog` | **file_picker** | Cross-platform, well-maintained |

---

## 3. Project Setup

### 3.1 Create the Project

```bash
flutter create --platforms=windows,macos,linux joytokey
cd joytokey
```

### 3.2 pubspec.yaml

```yaml
name: joytokey
description: Gamepad to keyboard mapper
version: 1.0.0+1
publish_to: none

environment:
  sdk: ">=3.4.0 <4.0.0"
  flutter: ">=3.22.0"

dependencies:
  flutter:
    sdk: flutter

  # State
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Models
  freezed_annotation: ^2.4.1
  json_annotation: ^4.9.0

  # Persistence
  path_provider: ^2.1.4

  # Navigation
  go_router: ^14.2.0

  # Platform integrations
  tray_manager: ^0.2.3
  window_manager: ^0.4.3
  hotkey_manager: ^0.2.3
  auto_updater: ^0.3.1
  file_picker: ^8.1.2

  # Utilities
  uuid: ^4.4.2
  collection: ^1.18.0
  ffi: ^2.1.3

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.12
  riverpod_generator: ^2.4.3
  freezed: ^2.5.2
  json_serializable: ^6.8.0
  flutter_lints: ^4.0.0
  mocktail: ^1.0.4
```

### 3.3 Windows CMake: Link HID Libraries

Edit `windows/CMakeLists.txt` to add HID and raw input dependencies:

```cmake
# After flutter_target_platform_architectures
target_link_libraries(${BINARY_NAME} PRIVATE
  hid
  setupapi
)
```

---

## 4. Directory Structure

```
joytokey/
├── lib/
│   ├── main.dart                          # Entry: ProviderScope, app init
│   ├── app.dart                           # MaterialApp.router + go_router
│   │
│   ├── core/
│   │   ├── constants.dart                 # App-wide constants (poll interval, etc.)
│   │   ├── logger.dart                    # Logging setup
│   │   └── result.dart                    # Result<T, E> type
│   │
│   ├── models/                            # Freezed data models (pure Dart)
│   │   ├── hid_device_info.dart
│   │   ├── joystick_event.dart
│   │   ├── mapping.dart
│   │   ├── profile.dart
│   │   ├── app_config.dart
│   │   ├── device_layout.dart
│   │   └── update_status.dart
│   │
│   ├── platform/                          # FFI + Method Channel bridges
│   │   ├── hid/
│   │   │   ├── hid_bindings.dart          # dart:ffi bindings to hidapi
│   │   │   ├── hid_manager.dart           # Enumerate, open/close lifecycle
│   │   │   ├── hid_reader.dart            # Per-device polling loop (Isolate)
│   │   │   ├── hid_parser.dart            # Buffer → JoystickEvent[]
│   │   │   └── device_descriptor.dart     # ParseStrategy, WhizToys detection
│   │   │
│   │   ├── keyboard/
│   │   │   ├── keyboard_injector.dart     # FFI → SendInput (Windows)
│   │   │   └── key_map.dart               # Key name → VK code mapping
│   │   │
│   │   ├── active_window/
│   │   │   └── active_window.dart         # FFI → GetForegroundWindow
│   │   │
│   │   └── system/
│   │       ├── autostart.dart             # Registry HKCU Run key (Windows)
│   │       └── platform_info.dart         # OS detection helpers
│   │
│   ├── services/
│   │   ├── hid_service.dart               # StateNotifier: device list + events
│   │   ├── mapping_engine.dart            # Process events → execute actions
│   │   ├── action_executor.dart           # Call KeyboardInjector
│   │   ├── config_store.dart              # JSON CRUD for AppConfig + Profiles
│   │   ├── profile_matcher.dart           # Auto-switch profiles
│   │   ├── dead_zone_filter.dart          # Axis normalization
│   │   └── updater_service.dart           # auto_updater wrapper
│   │
│   ├── providers/                         # Riverpod providers (code-gen)
│   │   ├── device_providers.dart
│   │   ├── profile_providers.dart
│   │   ├── config_providers.dart
│   │   ├── mapping_providers.dart
│   │   └── ui_providers.dart              # selectedDevicePath, activeTab
│   │
│   ├── ui/
│   │   ├── router.dart                    # go_router definition
│   │   ├── theme.dart                     # ThemeData (dark theme matching Electron)
│   │   │
│   │   ├── shell/
│   │   │   ├── app_shell.dart             # Title bar + sidebar + content area
│   │   │   ├── sidebar.dart               # 5-tab navigation
│   │   │   ├── title_bar.dart             # Draggable custom title bar
│   │   │   └── power_button.dart          # Global enable/disable toggle
│   │   │
│   │   ├── pages/
│   │   │   ├── devices_page.dart
│   │   │   ├── grid_page.dart
│   │   │   ├── mapping_page.dart
│   │   │   ├── profiles_page.dart
│   │   │   └── settings_page.dart
│   │   │
│   │   └── components/
│   │       ├── device_grid/
│   │       │   ├── device_grid.dart       # 3×3 grid widget
│   │       │   └── grid_tile.dart         # Single tile
│   │       ├── button_map/
│   │       │   ├── button_map.dart
│   │       │   ├── button_cell.dart
│   │       │   └── axis_gauge.dart
│   │       ├── key_assign_modal.dart
│   │       └── update_banner.dart
│
├── windows/
│   ├── runner/
│   │   └── main.cpp                       # Standard Flutter Windows entry
│   ├── third_party/
│   │   └── hidapi/                        # Clone from github.com/libusb/hidapi
│   └── CMakeLists.txt
│
├── test/
│   ├── unit/
│   │   ├── hid_parser_test.dart
│   │   ├── mapping_engine_test.dart
│   │   ├── dead_zone_filter_test.dart
│   │   └── config_store_test.dart
│   └── widget/
│       ├── devices_page_test.dart
│       └── key_assign_modal_test.dart
│
└── integration_test/
    └── app_test.dart
```

---

## 5. Data Models

All models use `freezed` for immutability and `json_serializable` for JSON encode/decode.

### 5.1 Core Models

```dart
// lib/models/hid_device_info.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'hid_device_info.freezed.dart';
part 'hid_device_info.g.dart';

@freezed
class HidDeviceInfo with _$HidDeviceInfo {
  const factory HidDeviceInfo({
    required String path,
    required int vendorId,
    required int productId,
    required String manufacturer,
    required String product,
    required String serialNumber,
    required int usage,
    required int usagePage,
    @Default(false) bool isOpen,
    DeviceLayout? layout,
  }) = _HidDeviceInfo;

  factory HidDeviceInfo.fromJson(Map<String, dynamic> json) =>
      _$HidDeviceInfoFromJson(json);
}
```

```dart
// lib/models/joystick_event.dart
enum JoystickEventType { button, axis, hat }

@freezed
class JoystickEvent with _$JoystickEvent {
  const factory JoystickEvent({
    required String devicePath,
    required JoystickEventType type,
    required int index,
    required double value,      // button: 0|1, axis: 0.0–1.0, hat: 0–8
    required int rawValue,
    required int timestamp,
  }) = _JoystickEvent;
}
```

```dart
// lib/models/mapping.dart
enum TriggerCondition { press, release, held, threshold }
enum ActionType { key, keyCombo, mouseButton, noop }
enum ModifierKey { control, shift, alt, meta }
enum HatDirection { n, ne, e, se, s, sw, w, nw }

@freezed
class InputTrigger with _$InputTrigger {
  const factory InputTrigger({
    required JoystickEventType type,
    required int index,
    required TriggerCondition condition,
    double? threshold,
    String? thresholdDir,       // 'above' | 'below'
    HatDirection? hatDir,
    int? holdDurationMs,
  }) = _InputTrigger;

  factory InputTrigger.fromJson(Map<String, dynamic> json) =>
      _$InputTriggerFromJson(json);
}

@freezed
class MappedAction with _$MappedAction {
  const factory MappedAction({
    required ActionType type,
    String? key,
    @Default([]) List<ModifierKey> modifiers,
    @Default(false) bool toggle,
    String? mouseButton,
    @Default(false) bool mouseDouble,
  }) = _MappedAction;

  factory MappedAction.fromJson(Map<String, dynamic> json) =>
      _$MappedActionFromJson(json);
}

@freezed
class GamepadMapping with _$GamepadMapping {
  const factory GamepadMapping({
    required String id,
    String? label,
    required InputTrigger trigger,
    required MappedAction action,
    @Default(true) bool enabled,
  }) = _GamepadMapping;

  factory GamepadMapping.fromJson(Map<String, dynamic> json) =>
      _$GamepadMappingFromJson(json);
}
```

```dart
// lib/models/profile.dart
@freezed
class Profile with _$Profile {
  const factory Profile({
    required String id,
    required String name,
    String? description,
    int? deviceVid,
    int? devicePid,
    String? deviceName,
    String? appIdentifier,         // Window class/exe name for auto-switch
    String? appName,
    @Default([]) List<GamepadMapping> mappings,
    @Default({}) Map<String, double> deadZones,   // "axisIndex" → 0.0–0.5
    @Default(16) int axisCount,
    @Default(32) int buttonCount,
    required int createdAt,
    required int updatedAt,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) =>
      _$ProfileFromJson(json);
}
```

```dart
// lib/models/app_config.dart
@freezed
class AppConfig with _$AppConfig {
  const factory AppConfig({
    @Default(2) int configVersion,
    String? activeProfileId,
    @Default([]) List<Profile> profiles,
    @Default(true) bool globalEnabled,
    @Default('Ctrl+Shift+J') String globalHotkey,
    @Default(false) bool launchAtLogin,
    @Default(true) bool minimizeToTray,
    @Default('info') String logLevel,
    @Default([]) List<String> connectedDevicePaths,
  }) = _AppConfig;

  factory AppConfig.fromJson(Map<String, dynamic> json) =>
      _$AppConfigFromJson(json);
}
```

### 5.2 Device Layout Model

```dart
// lib/models/device_layout.dart
@freezed
class TileInfo with _$TileInfo {
  const factory TileInfo({
    required int row,
    required int col,
    required int buttonIndex,   // -1 = placeholder
    required String label,
  }) = _TileInfo;

  factory TileInfo.fromJson(Map<String, dynamic> json) =>
      _$TileInfoFromJson(json);
}

@freezed
class DeviceLayout with _$DeviceLayout {
  const factory DeviceLayout({
    required int rows,
    required int cols,
    required List<TileInfo> tiles,
  }) = _DeviceLayout;

  factory DeviceLayout.fromJson(Map<String, dynamic> json) =>
      _$DeviceLayoutFromJson(json);
}
```

---

## 6. Platform Layer

### 6.1 HID Plugin (FFI)

The HID layer calls Win32 HID API directly via `dart:ffi`. This avoids spawning processes and gives microsecond-latency reads.

> **Build note:** Compile `hidapi` (https://github.com/libusb/hidapi) as a Windows DLL using CMake and place `hidapi.dll` alongside the `.exe`. Add it to `windows/CMakeLists.txt` as an `install` target.

#### 6.1.1 FFI Bindings

```dart
// lib/platform/hid/hid_bindings.dart
import 'dart:ffi';
import 'package:ffi/ffi.dart';

final class HidDeviceInfoC extends Struct {
  external Pointer<Utf8> path;
  @Uint16() external int vendorId;
  @Uint16() external int productId;
  external Pointer<Utf16> serialNumber;
  @Uint16() external int releaseNumber;
  external Pointer<Utf16> manufacturerString;
  external Pointer<Utf16> productString;
  @Uint16() external int usagePage;
  @Uint16() external int usage;
  @Int() external int interfaceNumber;
  external Pointer<HidDeviceInfoC> next;
}

typedef HidEnumerateC = Pointer<HidDeviceInfoC> Function(Uint16, Uint16);
typedef HidEnumerateDart = Pointer<HidDeviceInfoC> Function(int, int);
typedef HidOpenPathC = Pointer<Void> Function(Pointer<Utf8>);
typedef HidOpenPathDart = Pointer<Void> Function(Pointer<Utf8>);
typedef HidReadTimeoutC = Int Function(Pointer<Void>, Pointer<Uint8>, Size, Int);
typedef HidReadTimeoutDart = int Function(Pointer<Void>, Pointer<Uint8>, int, int);
typedef HidCloseC = Void Function(Pointer<Void>);
typedef HidCloseDart = void Function(Pointer<Void>);
typedef HidFreeEnumerationC = Void Function(Pointer<HidDeviceInfoC>);
typedef HidFreeEnumerationDart = void Function(Pointer<HidDeviceInfoC>);

class HidBindings {
  static HidBindings? _instance;
  static HidBindings get instance => _instance ??= HidBindings._();

  late final DynamicLibrary _lib;
  late final HidEnumerateDart enumerate;
  late final HidOpenPathDart openPath;
  late final HidReadTimeoutDart readTimeout;
  late final HidCloseDart close;
  late final HidFreeEnumerationDart freeEnumeration;

  HidBindings._() {
    _lib = DynamicLibrary.open('hidapi.dll');
    enumerate = _lib.lookupFunction<HidEnumerateC, HidEnumerateDart>('hid_enumerate');
    openPath = _lib.lookupFunction<HidOpenPathC, HidOpenPathDart>('hid_open_path');
    readTimeout = _lib.lookupFunction<HidReadTimeoutC, HidReadTimeoutDart>('hid_read_timeout');
    close = _lib.lookupFunction<HidCloseC, HidCloseDart>('hid_close');
    freeEnumeration = _lib.lookupFunction<HidFreeEnumerationC, HidFreeEnumerationDart>('hid_free_enumeration');
  }
}
```

#### 6.1.2 HID Manager

```dart
// lib/platform/hid/hid_manager.dart
import 'dart:async';
import 'dart:ffi';
import 'package:ffi/ffi.dart';
import 'hid_bindings.dart';
import 'device_descriptor.dart';
import 'hid_parser.dart';
import '../../models/hid_device_info.dart';
import '../../models/joystick_event.dart';

class HidManager {
  static const _pollInterval = Duration(milliseconds: 2000);

  final _devicesController = StreamController<List<HidDeviceInfo>>.broadcast();
  final _eventController = StreamController<JoystickEvent>.broadcast();

  Stream<List<HidDeviceInfo>> get devicesStream => _devicesController.stream;
  Stream<JoystickEvent> get eventStream => _eventController.stream;

  final Map<String, _OpenDevice> _openDevices = {};
  Timer? _pollTimer;
  List<HidDeviceInfo> _lastEnumerated = [];

  void start() {
    _pollTimer = Timer.periodic(_pollInterval, (_) => _poll());
    _poll();
  }

  void stop() {
    _pollTimer?.cancel();
    for (final d in _openDevices.values) d.close();
    _openDevices.clear();
  }

  List<HidDeviceInfo> enumerate() {
    final bindings = HidBindings.instance;
    final ptr = bindings.enumerate(0, 0);
    final devices = <HidDeviceInfo>[];
    var current = ptr;
    while (current != nullptr) {
      final dev = current.ref;
      if (dev.usagePage == 0x01 && (dev.usage == 0x04 || dev.usage == 0x05)) {
        final path = dev.path.toDartString();
        final product = dev.productString == nullptr
            ? '' : dev.productString.toDartString();
        final manufacturer = dev.manufacturerString == nullptr
            ? '' : dev.manufacturerString.toDartString();
        final layout = DeviceDescriptor.getLayout(
            dev.vendorId, dev.productId, product, manufacturer);
        devices.add(HidDeviceInfo(
          path: path,
          vendorId: dev.vendorId,
          productId: dev.productId,
          manufacturer: manufacturer,
          product: product,
          serialNumber: dev.serialNumber == nullptr
              ? '' : dev.serialNumber.toDartString(),
          usage: dev.usage,
          usagePage: dev.usagePage,
          isOpen: _openDevices.containsKey(path),
          layout: layout,
        ));
      }
      current = dev.next;
    }
    bindings.freeEnumeration(ptr);
    return devices;
  }

  Future<void> openDevice(String path, int vendorId, int productId) async {
    if (_openDevices.containsKey(path)) return;
    final bindings = HidBindings.instance;
    final pathPtr = path.toNativeUtf8();
    try {
      final handle = bindings.openPath(pathPtr);
      if (handle == nullptr) throw Exception('Failed to open HID device at $path');
      final strategy = DeviceDescriptor.getStrategy(vendorId, productId, '', '');
      final reader = _OpenDevice(
        handle: handle,
        path: path,
        strategy: strategy,
        onEvent: _eventController.add,
      );
      _openDevices[path] = reader;
      reader.startReading();
    } finally {
      calloc.free(pathPtr);
    }
  }

  void closeDevice(String path) {
    _openDevices.remove(path)?.close();
  }

  void _poll() {
    final current = enumerate();
    final currentPaths = current.map((d) => d.path).toSet();
    final prevPaths = _lastEnumerated.map((d) => d.path).toSet();

    for (final path in prevPaths.difference(currentPaths)) {
      if (_openDevices.containsKey(path)) closeDevice(path);
    }

    _lastEnumerated = current;
    _devicesController.add(current.map((d) => d.copyWith(
      isOpen: _openDevices.containsKey(d.path),
    )).toList());
  }
}

class _OpenDevice {
  final Pointer<Void> handle;
  final String path;
  final ParseStrategy strategy;
  final void Function(JoystickEvent) onEvent;
  Isolate? _isolate;

  _OpenDevice({
    required this.handle,
    required this.path,
    required this.strategy,
    required this.onEvent,
  });

  void startReading() {
    final receivePort = ReceivePort();
    Isolate.spawn(_readLoop, _ReadParams(
      handleAddress: handle.address,
      path: path,
      strategy: strategy,
      sendPort: receivePort.sendPort,
    )).then((iso) => _isolate = iso);
    receivePort.listen((msg) {
      if (msg is JoystickEvent) onEvent(msg);
    });
  }

  void close() {
    _isolate?.kill(priority: Isolate.immediate);
    HidBindings.instance.close(handle);
  }
}

// Top-level function required by Isolate.spawn
void _readLoop(_ReadParams params) {
  final bindings = HidBindings.instance;
  final handle = Pointer<Void>.fromAddress(params.handleAddress);
  final bufPtr = calloc<Uint8>(64);
  final parser = HidParser(params.strategy);
  while (true) {
    final n = bindings.readTimeout(handle, bufPtr, 64, 50);
    if (n > 0) {
      final buf = bufPtr.asTypedList(n);
      for (final e in parser.parse(buf, params.path)) {
        params.sendPort.send(e);
      }
    }
  }
}

class _ReadParams {
  final int handleAddress;
  final String path;
  final ParseStrategy strategy;
  final SendPort sendPort;
  const _ReadParams({
    required this.handleAddress,
    required this.path,
    required this.strategy,
    required this.sendPort,
  });
}
```

#### 6.1.3 HID Parser

```dart
// lib/platform/hid/hid_parser.dart
import 'dart:typed_data';
import '../../models/joystick_event.dart';
import 'device_descriptor.dart';

class HidParser {
  final ParseStrategy strategy;
  late final List<double> _prevAxes;
  late final List<bool> _prevButtons;
  int _prevHat = 8;

  HidParser(this.strategy)
      : _prevAxes = List.filled(strategy.axisCount, 0.5),
        _prevButtons = List.filled(strategy.buttonCount, false);

  List<JoystickEvent> parse(Uint8List buf, String devicePath) {
    final events = <JoystickEvent>[];
    final now = DateTime.now().millisecondsSinceEpoch;

    // Axes
    for (var i = 0; i < strategy.axisCount; i++) {
      final byteIndex = strategy.axisOffset + i * strategy.axisBytes;
      if (byteIndex >= buf.length) break;
      final raw = strategy.axisBytes == 2
          ? (buf[byteIndex] | (buf[byteIndex + 1] << 8))
          : buf[byteIndex];
      final normalized = raw / (strategy.axisBytes == 2 ? 65535.0 : 255.0);
      if ((normalized - _prevAxes[i]).abs() > 0.001) {
        _prevAxes[i] = normalized;
        events.add(JoystickEvent(
          devicePath: devicePath, type: JoystickEventType.axis,
          index: i, value: normalized, rawValue: raw, timestamp: now));
      }
    }

    // Buttons (bit-packed)
    for (var i = 0; i < strategy.buttonCount; i++) {
      final byteIndex = strategy.buttonOffset + (i >> 3);
      if (byteIndex >= buf.length) break;
      final pressed = (buf[byteIndex] >> (i & 7)) & 1 == 1;
      if (pressed != _prevButtons[i]) {
        _prevButtons[i] = pressed;
        events.add(JoystickEvent(
          devicePath: devicePath, type: JoystickEventType.button,
          index: i, value: pressed ? 1.0 : 0.0,
          rawValue: pressed ? 1 : 0, timestamp: now));
      }
    }

    // Hat switch
    if (strategy.hatOffset >= 0 && strategy.hatOffset < buf.length) {
      final hatNibble = buf[strategy.hatOffset] & 0x0F;
      final hatValue = hatNibble > 7 ? 8 : hatNibble;
      if (hatValue != _prevHat) {
        _prevHat = hatValue;
        events.add(JoystickEvent(
          devicePath: devicePath, type: JoystickEventType.hat,
          index: 0, value: hatValue.toDouble(),
          rawValue: hatValue, timestamp: now));
      }
    }

    return events;
  }
}
```

#### 6.1.4 Device Descriptor

```dart
// lib/platform/hid/device_descriptor.dart
import '../../models/device_layout.dart';

class ParseStrategy {
  final int axisCount;
  final int buttonCount;
  final int axisOffset;
  final int axisBytes;
  final int buttonOffset;
  final int hatOffset;      // -1 if no hat
  final String name;

  const ParseStrategy({
    required this.axisCount, required this.buttonCount,
    required this.axisOffset, required this.axisBytes,
    required this.buttonOffset, required this.hatOffset,
    required this.name,
  });
}

class DeviceDescriptor {
  static const _whizToysStrategy = ParseStrategy(
    axisCount: 0, buttonCount: 8,
    axisOffset: 1, axisBytes: 1,
    buttonOffset: 0, hatOffset: -1,
    name: 'WhizToys BLE Gamepad',
  );

  static const _genericStrategy = ParseStrategy(
    axisCount: 6, buttonCount: 16,
    axisOffset: 0, axisBytes: 2,
    buttonOffset: 12, hatOffset: 11,
    name: 'Generic Gamepad',
  );

  static bool isWhizToys(String product, String manufacturer) {
    final p = product.toLowerCase();
    final m = manufacturer.toLowerCase();
    return p.endsWith('-jyt') || p.contains('wts') ||
           p.contains('whiztoys') || m.contains('whiztoys');
  }

  static ParseStrategy getStrategy(
      int vendorId, int productId, String product, String manufacturer) {
    if (isWhizToys(product, manufacturer)) return _whizToysStrategy;
    return _genericStrategy;
  }

  static DeviceLayout? getLayout(
      int vendorId, int productId, String product, String manufacturer) {
    if (!isWhizToys(product, manufacturer)) return null;
    return const DeviceLayout(
      rows: 3, cols: 3,
      tiles: [
        TileInfo(row: 0, col: 0, buttonIndex: 0, label: 'TL'),
        TileInfo(row: 0, col: 1, buttonIndex: 1, label: 'TC'),
        TileInfo(row: 0, col: 2, buttonIndex: 2, label: 'TR'),
        TileInfo(row: 1, col: 0, buttonIndex: 3, label: 'ML'),
        TileInfo(row: 1, col: 1, buttonIndex: -1, label: ''),
        TileInfo(row: 1, col: 2, buttonIndex: 4, label: 'MR'),
        TileInfo(row: 2, col: 0, buttonIndex: 5, label: 'BL'),
        TileInfo(row: 2, col: 1, buttonIndex: 6, label: 'BC'),
        TileInfo(row: 2, col: 2, buttonIndex: 7, label: 'BR'),
      ],
    );
  }
}
```

### 6.2 Keyboard Injector (FFI → SendInput)

```dart
// lib/platform/keyboard/keyboard_injector.dart
import 'dart:ffi';
import 'package:ffi/ffi.dart';
import 'key_map.dart';
import '../../models/mapping.dart';

final class Input extends Struct {
  @Uint32() external int type;
  external KeybdInput ki;
}

final class KeybdInput extends Struct {
  @Uint16() external int wVk;
  @Uint16() external int wScan;
  @Uint32() external int dwFlags;
  @Uint32() external int time;
  external Pointer<Uint64> dwExtraInfo;
}

const _inputKeyboard = 1;
const _keyeventfKeyup = 0x0002;

typedef SendInputC = Uint32 Function(Uint32, Pointer<Input>, Int32);
typedef SendInputDart = int Function(int, Pointer<Input>, int);

class KeyboardInjector {
  static KeyboardInjector? _instance;
  static KeyboardInjector get instance => _instance ??= KeyboardInjector._();

  late final SendInputDart _sendInput;

  KeyboardInjector._() {
    final user32 = DynamicLibrary.open('user32.dll');
    _sendInput = user32
        .lookupFunction<SendInputC, SendInputDart>('SendInput');
  }

  void keyPress(MappedAction action) {
    _sendKeys(action, isDown: true);
    if (!action.toggle) _sendKeys(action, isDown: false);
  }

  void keyDown(MappedAction action) => _sendKeys(action, isDown: true);
  void keyUp(MappedAction action) => _sendKeys(action, isDown: false);

  void _sendKeys(MappedAction action, {required bool isDown}) {
    if (action.key == null) return;
    final keys = [
      ...action.modifiers.map((m) => KeyMap.modifierVk(m)),
      KeyMap.keyVk(action.key!),
    ].where((vk) => vk != 0).toList();

    final sequence = isDown ? keys : keys.reversed.toList();
    final inputs = calloc<Input>(sequence.length);
    try {
      for (var i = 0; i < sequence.length; i++) {
        inputs[i].type = _inputKeyboard;
        inputs[i].ki.wVk = sequence[i];
        inputs[i].ki.wScan = 0;
        inputs[i].ki.dwFlags = isDown ? 0 : _keyeventfKeyup;
        inputs[i].ki.time = 0;
      }
      _sendInput(sequence.length, inputs, sizeOf<Input>());
    } finally {
      calloc.free(inputs);
    }
  }
}
```

```dart
// lib/platform/keyboard/key_map.dart
import '../../models/mapping.dart';

class KeyMap {
  static const Map<String, int> _keys = {
    'space': 0x20, 'return': 0x0D, 'escape': 0x1B, 'tab': 0x09,
    'backspace': 0x08, 'delete': 0x2E, 'insert': 0x2D,
    'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27,
    'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73,
    'f5': 0x74, 'f6': 0x75, 'f7': 0x76, 'f8': 0x77,
    'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B,
    'a': 0x41, 'b': 0x42, 'c': 0x43, 'd': 0x44, 'e': 0x45,
    'f': 0x46, 'g': 0x47, 'h': 0x48, 'i': 0x49, 'j': 0x4A,
    'k': 0x4B, 'l': 0x4C, 'm': 0x4D, 'n': 0x4E, 'o': 0x4F,
    'p': 0x50, 'q': 0x51, 'r': 0x52, 's': 0x53, 't': 0x54,
    'u': 0x55, 'v': 0x56, 'w': 0x57, 'x': 0x58, 'y': 0x59, 'z': 0x5A,
    '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
    '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
  };

  static const Map<ModifierKey, int> _modifiers = {
    ModifierKey.control: 0x11,
    ModifierKey.shift: 0x10,
    ModifierKey.alt: 0x12,
    ModifierKey.meta: 0x5B,
  };

  static int keyVk(String name) => _keys[name.toLowerCase()] ?? 0;
  static int modifierVk(ModifierKey mod) => _modifiers[mod] ?? 0;
}
```

### 6.3 Active Window Detection

```dart
// lib/platform/active_window/active_window.dart
import 'dart:ffi';
import 'package:ffi/ffi.dart';

typedef GetForegroundWindowC = IntPtr Function();
typedef GetForegroundWindowDart = int Function();
typedef GetWindowTextWC = Int32 Function(IntPtr, Pointer<Utf16>, Int32);
typedef GetWindowTextWDart = int Function(int, Pointer<Utf16>, int);

class ActiveWindowService {
  static ActiveWindowService? _instance;
  static ActiveWindowService get instance => _instance ??= ActiveWindowService._();

  late final GetForegroundWindowDart _getForegroundWindow;
  late final GetWindowTextWDart _getWindowText;

  ActiveWindowService._() {
    final user32 = DynamicLibrary.open('user32.dll');
    _getForegroundWindow = user32
        .lookupFunction<GetForegroundWindowC, GetForegroundWindowDart>(
            'GetForegroundWindow');
    _getWindowText = user32
        .lookupFunction<GetWindowTextWC, GetWindowTextWDart>('GetWindowTextW');
  }

  String? getActiveWindowTitle() {
    final hwnd = _getForegroundWindow();
    if (hwnd == 0) return null;
    final buf = calloc<Utf16>(256);
    try {
      final len = _getWindowText(hwnd, buf, 256);
      if (len == 0) return null;
      return buf.toDartString(length: len);
    } finally {
      calloc.free(buf);
    }
  }
}
```

### 6.4 Autostart (Windows Registry)

```dart
// lib/platform/system/autostart.dart
import 'dart:io';

class AutostartService {
  static const _keyPath =
      r'HKCU\Software\Microsoft\Windows\CurrentVersion\Run';
  static const _appName = 'JoyToKey';

  static Future<void> setEnabled(bool enabled) async {
    final exePath = Platform.resolvedExecutable;
    if (enabled) {
      await Process.run('reg', [
        'add', _keyPath, '/v', _appName,
        '/t', 'REG_SZ', '/d', '"$exePath"', '/f',
      ]);
    } else {
      await Process.run('reg', ['delete', _keyPath, '/v', _appName, '/f']);
    }
  }

  static Future<bool> isEnabled() async {
    final result = await Process.run('reg', [
      'query', _keyPath, '/v', _appName,
    ]);
    return result.exitCode == 0;
  }
}
```

---

## 7. Services Layer

### 7.1 Mapping Engine

```dart
// lib/services/mapping_engine.dart
import '../models/joystick_event.dart';
import '../models/mapping.dart';
import '../models/profile.dart';
import 'action_executor.dart';
import 'dead_zone_filter.dart';

class MappingEngine {
  Profile? _activeProfile;
  bool _enabled = true;

  final Map<String, bool> _buttonState = {};
  final Map<String, bool> _axisTriggered = {};
  final Map<int, int> _hatState = {};

  final ActionExecutor _executor;
  final DeadZoneFilter _deadZone;

  MappingEngine(this._executor, this._deadZone);

  void setProfile(Profile? profile) {
    _releaseAllHeld();
    _activeProfile = profile;
    _buttonState.clear();
    _axisTriggered.clear();
    _hatState.clear();
  }

  void setEnabled(bool enabled) {
    if (!enabled) _releaseAllHeld();
    _enabled = enabled;
  }

  void processEvent(JoystickEvent raw) {
    if (!_enabled || _activeProfile == null) return;
    final event = raw.type == JoystickEventType.axis
        ? _deadZone.apply(raw, _activeProfile!.deadZones)
        : raw;
    for (final mapping in _activeProfile!.mappings) {
      if (!mapping.enabled) continue;
      if (!_triggerMatches(mapping.trigger, event)) continue;
      if (_shouldFire(mapping.trigger, event)) {
        _executor.execute(mapping.action, _isKeyDown(mapping.trigger, event));
      }
    }
  }

  bool _triggerMatches(InputTrigger trigger, JoystickEvent event) =>
      trigger.type == event.type && trigger.index == event.index;

  bool _shouldFire(InputTrigger trigger, JoystickEvent event) {
    switch (trigger.type) {
      case JoystickEventType.button:
        final key = 'button:${event.index}';
        final wasPressed = _buttonState[key] ?? false;
        final isPressed = event.value > 0.5;
        _buttonState[key] = isPressed;
        return switch (trigger.condition) {
          TriggerCondition.press   => !wasPressed && isPressed,
          TriggerCondition.release => wasPressed && !isPressed,
          TriggerCondition.held    => isPressed,
          _                        => false,
        };

      case JoystickEventType.axis:
        final threshold = trigger.threshold ?? 0.7;
        final dir = trigger.thresholdDir ?? 'above';
        final stateKey = 'axis:${event.index}:$dir:$threshold';
        final wasTriggered = _axisTriggered[stateKey] ?? false;
        final isTriggered = dir == 'above'
            ? event.value > threshold
            : event.value < threshold;
        if (isTriggered != wasTriggered) {
          _axisTriggered[stateKey] = isTriggered;
          return true;
        }
        return false;

      case JoystickEventType.hat:
        final dir = trigger.hatDir;
        if (dir == null) return false;
        final prevDir = _hatState[event.index];
        final curDir = event.value == 8 ? null : event.value.toInt();
        _hatState[event.index] = curDir ?? 8;
        final isMatch = curDir == dir.index;
        final wasMatch = prevDir == dir.index;
        return switch (trigger.condition) {
          TriggerCondition.press   => !wasMatch && isMatch,
          TriggerCondition.release => wasMatch && !isMatch,
          TriggerCondition.held    => isMatch,
          _                        => false,
        };
    }
  }

  bool _isKeyDown(InputTrigger trigger, JoystickEvent event) =>
      trigger.type != JoystickEventType.button || event.value > 0.5;

  void _releaseAllHeld() {
    if (_activeProfile == null) return;
    _buttonState.forEach((key, pressed) {
      if (!pressed) return;
      final index = int.tryParse(key.split(':')[1]) ?? -1;
      for (final m in _activeProfile!.mappings) {
        if (m.trigger.type == JoystickEventType.button &&
            m.trigger.index == index &&
            m.action.toggle == true) {
          _executor.execute(m.action, false);
        }
      }
    });
  }
}
```

### 7.2 Dead Zone Filter

```dart
// lib/services/dead_zone_filter.dart
import '../models/joystick_event.dart';

class DeadZoneFilter {
  static const _defaultDeadZone = 0.1;

  JoystickEvent apply(JoystickEvent event, Map<String, double> deadZones) {
    assert(event.type == JoystickEventType.axis);
    final dz = deadZones['${event.index}'] ?? _defaultDeadZone;
    final center = 0.5;
    if ((event.value - center).abs() < dz) {
      return event.copyWith(value: center);
    }
    return event;
  }
}
```

### 7.3 Action Executor

```dart
// lib/services/action_executor.dart
import '../models/mapping.dart';
import '../platform/keyboard/keyboard_injector.dart';

class ActionExecutor {
  final _injector = KeyboardInjector.instance;

  void execute(MappedAction action, bool isDown) {
    switch (action.type) {
      case ActionType.key:
      case ActionType.keyCombo:
        if (action.toggle) {
          isDown ? _injector.keyDown(action) : _injector.keyUp(action);
        } else if (isDown) {
          _injector.keyPress(action);
        }
      case ActionType.mouseButton:
        if (isDown) _sendMouseClick(action);
      case ActionType.noop:
        break;
    }
  }

  void _sendMouseClick(MappedAction action) {
    // TODO: implement via SendInput MOUSEINPUT struct
  }
}
```

### 7.4 Config Store

```dart
// lib/services/config_store.dart
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../models/app_config.dart';
import '../models/profile.dart';
import '../models/mapping.dart';

class ConfigStore {
  static const _configFile = 'config.json';
  late String _configPath;

  Future<void> init() async {
    final dir = await getApplicationSupportDirectory();
    _configPath = '${dir.path}/$_configFile';
  }

  Future<AppConfig> getConfig() async {
    final file = File(_configPath);
    if (!await file.exists()) return const AppConfig();
    try {
      final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return AppConfig.fromJson(json);
    } catch (_) {
      return const AppConfig();
    }
  }

  Future<void> saveConfig(AppConfig config) async {
    final temp = File('$_configPath.tmp');
    await temp.writeAsString(jsonEncode(config.toJson()));
    await temp.rename(_configPath);
  }

  Future<AppConfig> updateConfig(AppConfig Function(AppConfig) updater) async {
    final updated = updater(await getConfig());
    await saveConfig(updated);
    return updated;
  }

  Future<Profile> saveProfile(Profile profile) async {
    final config = await updateConfig((c) {
      final profiles = [...c.profiles];
      final idx = profiles.indexWhere((p) => p.id == profile.id);
      idx >= 0 ? profiles[idx] = profile : profiles.add(profile);
      return c.copyWith(profiles: profiles);
    });
    return config.profiles.firstWhere((p) => p.id == profile.id);
  }

  Future<void> deleteProfile(String id) async {
    await updateConfig((c) => c.copyWith(
      profiles: c.profiles.where((p) => p.id != id).toList(),
      activeProfileId: c.activeProfileId == id ? null : c.activeProfileId,
    ));
  }

  Profile createDefaultProfile() => Profile(
    id: const Uuid().v4(),
    name: 'Default',
    axisCount: 6,
    buttonCount: 16,
    createdAt: DateTime.now().millisecondsSinceEpoch,
    updatedAt: DateTime.now().millisecondsSinceEpoch,
  );

  Profile createWhizToysProfile(String deviceName) => Profile(
    id: const Uuid().v4(),
    name: 'WhizToys - $deviceName',
    deviceName: deviceName,
    buttonCount: 8,
    axisCount: 0,
    mappings: _defaultWhizToysMappings(),
    createdAt: DateTime.now().millisecondsSinceEpoch,
    updatedAt: DateTime.now().millisecondsSinceEpoch,
  );

  List<GamepadMapping> _defaultWhizToysMappings() => [
    for (final (i, key) in [
      (0, 'up'), (1, 'down'), (2, 'left'), (3, 'right'),
      (4, 'space'), (5, 'return'), (6, 'escape'), (7, 'tab'),
    ])
      GamepadMapping(
        id: const Uuid().v4(),
        trigger: InputTrigger(
          type: JoystickEventType.button,
          index: i, condition: TriggerCondition.press),
        action: MappedAction(type: ActionType.key, key: key),
      ),
  ];
}
```

---

## 8. Riverpod Providers

```dart
// lib/providers/device_providers.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../platform/hid/hid_manager.dart';
import '../models/hid_device_info.dart';
import '../models/joystick_event.dart';
part 'device_providers.g.dart';

@Riverpod(keepAlive: true)
HidManager hidManager(HidManagerRef ref) {
  final manager = HidManager();
  ref.onDispose(manager.stop);
  manager.start();
  return manager;
}

@Riverpod(keepAlive: true)
Stream<List<HidDeviceInfo>> deviceList(DeviceListRef ref) =>
    ref.watch(hidManagerProvider).devicesStream;

@Riverpod(keepAlive: true)
Stream<JoystickEvent> joystickEvents(JoystickEventsRef ref) =>
    ref.watch(hidManagerProvider).eventStream;
```

```dart
// lib/providers/profile_providers.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../models/app_config.dart';
import '../models/profile.dart';
import '../services/config_store.dart';
part 'profile_providers.g.dart';

@Riverpod(keepAlive: true)
ConfigStore configStore(ConfigStoreRef ref) => throw UnimplementedError();

@Riverpod(keepAlive: true)
class ProfilesNotifier extends _$ProfilesNotifier {
  @override
  Future<AppConfig> build() => ref.watch(configStoreProvider).getConfig();

  Future<void> saveProfile(Profile profile) async {
    await ref.read(configStoreProvider).saveProfile(profile);
    ref.invalidateSelf();
  }

  Future<void> deleteProfile(String id) async {
    await ref.read(configStoreProvider).deleteProfile(id);
    ref.invalidateSelf();
  }

  Future<void> setActiveProfile(String? id) async {
    await ref.read(configStoreProvider).updateConfig(
        (c) => c.copyWith(activeProfileId: id));
    final config = await ref.read(configStoreProvider).getConfig();
    final profile = id == null
        ? null
        : config.profiles.firstWhereOrNull((p) => p.id == id);
    ref.read(mappingEngineProvider).setProfile(profile);
    ref.invalidateSelf();
  }
}
```

```dart
// lib/providers/mapping_providers.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../services/mapping_engine.dart';
import '../services/action_executor.dart';
import '../services/dead_zone_filter.dart';
part 'mapping_providers.g.dart';

@Riverpod(keepAlive: true)
MappingEngine mappingEngine(MappingEngineRef ref) {
  final engine = MappingEngine(ActionExecutor(), DeadZoneFilter());
  ref.listen(joystickEventsProvider, (_, event) {
    event.whenData(engine.processEvent);
  });
  return engine;
}
```

```dart
// lib/providers/ui_providers.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'ui_providers.g.dart';

@riverpod
class SelectedDevicePath extends _$SelectedDevicePath {
  @override
  String? build() => null;
  void select(String? path) => state = path;
}

@riverpod
class ActiveTab extends _$ActiveTab {
  @override
  int build() => 0;
  void set(int tab) => state = tab;
}
```

---

## 9. UI Implementation

### 9.1 Theme

```dart
// lib/ui/theme.dart
import 'package:flutter/material.dart';

final joytokeyTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: const ColorScheme.dark(
    primary: Color(0xFF6366F1),
    secondary: Color(0xFF22C55E),
    surface: Color(0xFF1E1E2E),
    surfaceContainerHighest: Color(0xFF2A2A3E),
    onSurface: Color(0xFFCDD6F4),
    outline: Color(0xFF45475A),
  ),
  cardTheme: const CardThemeData(
    color: Color(0xFF2A2A3E),
    elevation: 0,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: const Color(0xFF313244),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: Color(0xFF45475A)),
    ),
  ),
);
```

### 9.2 Router

```dart
// lib/ui/router.dart
import 'package:go_router/go_router.dart';
import 'shell/app_shell.dart';
import 'pages/devices_page.dart';
import 'pages/grid_page.dart';
import 'pages/mapping_page.dart';
import 'pages/profiles_page.dart';
import 'pages/settings_page.dart';

final router = GoRouter(
  initialLocation: '/devices',
  routes: [
    ShellRoute(
      builder: (ctx, state, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/devices', builder: (_, __) => const DevicesPage()),
        GoRoute(path: '/grid',    builder: (_, __) => const GridPage()),
        GoRoute(path: '/mapping', builder: (_, __) => const MappingPage()),
        GoRoute(path: '/profiles',builder: (_, __) => const ProfilesPage()),
        GoRoute(path: '/settings',builder: (_, __) => const SettingsPage()),
      ],
    ),
  ],
);
```

### 9.3 App Shell

```dart
// lib/ui/shell/app_shell.dart
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'sidebar.dart';
import 'title_bar.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({required this.child, super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          const AppTitleBar(),
          Expanded(
            child: Row(
              children: [
                const AppSidebar(),
                const VerticalDivider(width: 1),
                Expanded(child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// lib/ui/shell/title_bar.dart
class AppTitleBar extends StatelessWidget {
  const AppTitleBar({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: (_) => windowManager.startDragging(),
      child: Container(
        height: 40,
        color: const Color(0xFF1E1E2E),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            const FlutterLogo(size: 18),
            const SizedBox(width: 8),
            Text('JoyToKey',
                style: Theme.of(context).textTheme.labelLarge),
            const Spacer(),
            const PowerButton(),
            const _WindowControls(),
          ],
        ),
      ),
    );
  }
}

class _WindowControls extends StatelessWidget {
  const _WindowControls();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          icon: const Icon(Icons.minimize, size: 16),
          onPressed: windowManager.minimize,
        ),
        IconButton(
          icon: const Icon(Icons.close, size: 16),
          onPressed: windowManager.close,
        ),
      ],
    );
  }
}
```

```dart
// lib/ui/shell/sidebar.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/ui_providers.dart';

class AppSidebar extends ConsumerWidget {
  const AppSidebar({super.key});

  static const _tabs = [
    (icon: Icons.usb,        label: 'Devices',  route: '/devices'),
    (icon: Icons.grid_view,  label: 'Grid',     route: '/grid'),
    (icon: Icons.gamepad,    label: 'Mapping',  route: '/mapping'),
    (icon: Icons.person,     label: 'Profiles', route: '/profiles'),
    (icon: Icons.settings,   label: 'Settings', route: '/settings'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeTab = ref.watch(activeTabProvider);
    return SizedBox(
      width: 80,
      child: Column(
        children: _tabs.asMap().entries.map((e) {
          final i = e.key;
          final tab = e.value;
          return _SidebarItem(
            icon: tab.icon,
            label: tab.label,
            selected: activeTab == i,
            onTap: () {
              ref.read(activeTabProvider.notifier).set(i);
              context.go(tab.route);
            },
          );
        }).toList(),
      ),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.icon, required this.label,
    required this.selected, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: 80, height: 64,
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                width: 3,
                color: selected
                    ? Theme.of(context).colorScheme.primary
                    : Colors.transparent,
              ),
            ),
            color: selected
                ? Theme.of(context).colorScheme.primary.withOpacity(0.1)
                : Colors.transparent,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20,
                  color: selected
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.onSurface),
              const SizedBox(height: 4),
              Text(label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.onSurface,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}
```

```dart
// lib/ui/shell/power_button.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/mapping_providers.dart';

class PowerButton extends ConsumerWidget {
  const PowerButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled = ref.watch(mappingEnabledProvider);
    return IconButton(
      icon: Icon(
        Icons.power_settings_new,
        color: enabled ? Theme.of(context).colorScheme.secondary : Colors.grey,
      ),
      tooltip: enabled ? 'Active — click to pause' : 'Paused — click to activate',
      onPressed: () {
        final engine = ref.read(mappingEngineProvider);
        engine.setEnabled(!enabled);
        ref.invalidate(mappingEnabledProvider);
      },
    );
  }
}
```

### 9.4 Devices Page

```dart
// lib/ui/pages/devices_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/device_providers.dart';
import '../../models/hid_device_info.dart';

class DevicesPage extends ConsumerWidget {
  const DevicesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devicesAsync = ref.watch(deviceListProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Devices', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          devicesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Error: $e'),
            data: (devices) => devices.isEmpty
                ? const Center(child: Text('No gamepads detected'))
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: devices.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (ctx, i) => _DeviceTile(device: devices[i]),
                  ),
          ),
        ],
      ),
    );
  }
}

class _DeviceTile extends ConsumerWidget {
  final HidDeviceInfo device;
  const _DeviceTile({required this.device});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final manager = ref.read(hidManagerProvider);
    return ListTile(
      leading: _StatusDot(connected: device.isOpen),
      title: Text(device.product.isNotEmpty ? device.product : 'Unknown Device'),
      subtitle: Text(
        '${device.manufacturer} — '
        '${device.vendorId.toRadixString(16).padLeft(4, '0').toUpperCase()}:'
        '${device.productId.toRadixString(16).padLeft(4, '0').toUpperCase()}',
      ),
      trailing: device.isOpen
          ? OutlinedButton(
              onPressed: () => manager.closeDevice(device.path),
              child: const Text('Disconnect'),
            )
          : FilledButton(
              onPressed: () =>
                  manager.openDevice(device.path, device.vendorId, device.productId),
              child: const Text('Connect'),
            ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final bool connected;
  const _StatusDot({required this.connected});

  @override
  Widget build(BuildContext context) => Container(
    width: 10, height: 10,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: connected ? Colors.green : Colors.grey,
    ),
  );
}
```

### 9.5 Grid Page

```dart
// lib/ui/pages/grid_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:collection/collection.dart';
import 'package:uuid/uuid.dart';
import '../components/device_grid/device_grid.dart';
import '../components/key_assign_modal.dart';
import '../../providers/device_providers.dart';
import '../../providers/profile_providers.dart';
import '../../models/mapping.dart';
import '../../models/profile.dart';
import '../../models/device_layout.dart';

class GridPage extends ConsumerStatefulWidget {
  const GridPage({super.key});

  @override
  ConsumerState<GridPage> createState() => _GridPageState();
}

class _GridPageState extends ConsumerState<GridPage> {
  bool _editMode = false;

  @override
  Widget build(BuildContext context) {
    final devicesAsync = ref.watch(deviceListProvider);
    final profileAsync = ref.watch(profilesNotifierProvider);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Grid Layout',
                  style: Theme.of(context).textTheme.headlineSmall),
              const Spacer(),
              TextButton.icon(
                onPressed: () => setState(() => _editMode = !_editMode),
                icon: Icon(_editMode ? Icons.check : Icons.edit),
                label: Text(_editMode ? 'Done' : 'Edit Layout'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          devicesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Error: $e'),
            data: (devices) {
              final whizToys = devices.firstWhereOrNull(
                  (d) => d.isOpen && d.layout != null);
              if (whizToys == null) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      'Connect a WhizToys device to use the grid editor.\n'
                      'Use the Mapping tab for generic gamepads.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              }
              return profileAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Error: $e'),
                data: (config) {
                  final profile = config.activeProfileId == null
                      ? null
                      : config.profiles.firstWhereOrNull(
                          (p) => p.id == config.activeProfileId);
                  return DeviceGrid(
                    layout: whizToys.layout!,
                    profile: profile,
                    editMode: _editMode,
                    onTileTap: (tile) =>
                        _showKeyAssign(context, tile, profile),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _showKeyAssign(
      BuildContext context, TileInfo tile, Profile? profile) async {
    if (profile == null || tile.buttonIndex < 0) return;
    final currentAction = profile.mappings
        .firstWhereOrNull((m) =>
            m.trigger.type == JoystickEventType.button &&
            m.trigger.index == tile.buttonIndex)
        ?.action;

    final result = await showDialog<MappedAction>(
      context: context,
      builder: (_) => KeyAssignModal(
        title: 'Assign Key — ${tile.label}',
        currentAction: currentAction,
      ),
    );
    if (result != null && mounted) {
      await ref
          .read(profilesNotifierProvider.notifier)
          .saveProfile(_upsertMapping(profile, tile.buttonIndex, result));
    }
  }

  Profile _upsertMapping(
      Profile profile, int buttonIndex, MappedAction action) {
    final mappings = [...profile.mappings];
    final idx = mappings.indexWhere((m) =>
        m.trigger.type == JoystickEventType.button &&
        m.trigger.index == buttonIndex);
    final mapping = GamepadMapping(
      id: idx >= 0 ? mappings[idx].id : const Uuid().v4(),
      trigger: InputTrigger(
        type: JoystickEventType.button,
        index: buttonIndex,
        condition: TriggerCondition.press,
      ),
      action: action,
    );
    idx >= 0 ? mappings[idx] = mapping : mappings.add(mapping);
    return profile.copyWith(
        mappings: mappings,
        updatedAt: DateTime.now().millisecondsSinceEpoch);
  }
}
```

### 9.6 Device Grid Component

```dart
// lib/ui/components/device_grid/device_grid.dart
import 'package:flutter/material.dart';
import 'package:collection/collection.dart';
import '../../../models/device_layout.dart';
import '../../../models/profile.dart';
import '../../../models/mapping.dart';
import 'grid_tile.dart';

class DeviceGrid extends StatefulWidget {
  final DeviceLayout layout;
  final Profile? profile;
  final bool editMode;
  final void Function(TileInfo tile) onTileTap;

  const DeviceGrid({
    required this.layout, required this.profile,
    required this.editMode, required this.onTileTap,
    super.key,
  });

  @override
  State<DeviceGrid> createState() => _DeviceGridState();
}

class _DeviceGridState extends State<DeviceGrid> {
  late List<TileInfo> _tiles;

  @override
  void initState() {
    super.initState();
    _tiles = [...widget.layout.tiles];
    // TODO: restore tile order from shared_preferences keyed by VID:PID
  }

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: widget.layout.cols,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1.0,
      ),
      itemCount: _tiles.length,
      itemBuilder: (ctx, i) {
        final tile = _tiles[i];
        final mappedAction = tile.buttonIndex < 0
            ? null
            : widget.profile?.mappings
                .firstWhereOrNull((m) =>
                    m.trigger.type == JoystickEventType.button &&
                    m.trigger.index == tile.buttonIndex)
                ?.action;

        return GridTileWidget(
          tile: tile,
          mappedAction: mappedAction,
          editMode: widget.editMode,
          onTap: tile.buttonIndex >= 0
              ? () => widget.onTileTap(tile)
              : null,
        );
      },
    );
  }
}
```

```dart
// lib/ui/components/device_grid/grid_tile.dart
import 'package:flutter/material.dart';
import '../../../models/device_layout.dart';
import '../../../models/mapping.dart';

class GridTileWidget extends StatelessWidget {
  final TileInfo tile;
  final MappedAction? mappedAction;
  final bool editMode;
  final VoidCallback? onTap;

  const GridTileWidget({
    required this.tile, required this.mappedAction,
    required this.editMode, this.onTap, super.key,
  });

  @override
  Widget build(BuildContext context) {
    final isPlaceholder = tile.buttonIndex < 0;
    final hasMapping = mappedAction != null &&
        mappedAction!.type != ActionType.noop;

    return GestureDetector(
      onTap: isPlaceholder ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: isPlaceholder
              ? Colors.transparent
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          border: isPlaceholder
              ? null
              : Border.all(
                  color: hasMapping
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outline,
                  width: hasMapping ? 2 : 1,
                ),
        ),
        child: isPlaceholder
            ? null
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (editMode)
                    const Icon(Icons.drag_handle, size: 16),
                  Text(tile.label,
                      style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 4),
                  Text(
                    hasMapping ? _formatAction(mappedAction!) : '—',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: hasMapping
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.outline,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  String _formatAction(MappedAction action) {
    if (action.key == null) return '—';
    final mods = action.modifiers.map((m) => m.name).join('+');
    return mods.isNotEmpty ? '$mods+${action.key}' : action.key!;
  }
}
```

### 9.7 Key Assign Modal

```dart
// lib/ui/components/key_assign_modal.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/mapping.dart';

class KeyAssignModal extends StatefulWidget {
  final String title;
  final MappedAction? currentAction;
  const KeyAssignModal({required this.title, this.currentAction, super.key});

  @override
  State<KeyAssignModal> createState() => _KeyAssignModalState();
}

class _KeyAssignModalState extends State<KeyAssignModal> {
  String? _capturedKey;
  Set<ModifierKey> _modifiers = {};
  bool _listening = false;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    if (widget.currentAction != null) {
      _capturedKey = widget.currentAction!.key;
      _modifiers = Set.from(widget.currentAction!.modifiers);
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 320,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Focus(
              focusNode: _focusNode,
              onKey: (node, event) {
                if (event is RawKeyDownEvent) {
                  _captureKey(event);
                  return KeyEventResult.handled;
                }
                return KeyEventResult.ignored;
              },
              child: GestureDetector(
                onTap: () {
                  setState(() => _listening = true);
                  _focusNode.requestFocus();
                },
                child: Container(
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _listening
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.outline,
                      width: _listening ? 2 : 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    _capturedKey != null
                        ? _formatKey()
                        : _listening
                            ? 'Press any key...'
                            : 'Click to capture key',
                    style: _capturedKey != null
                        ? Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          )
                        : null,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: ModifierKey.values
                  .map((mod) => FilterChip(
                        label: Text(_capitalize(mod.name)),
                        selected: _modifiers.contains(mod),
                        onSelected: (v) => setState(() =>
                            v ? _modifiers.add(mod) : _modifiers.remove(mod)),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Cancel'),
        ),
        if (_capturedKey != null)
          TextButton(
            onPressed: () => Navigator.of(context)
                .pop(const MappedAction(type: ActionType.noop)),
            child: const Text('Clear'),
          ),
        FilledButton(
          onPressed: _capturedKey == null
              ? null
              : () => Navigator.of(context).pop(MappedAction(
                    type: _modifiers.isEmpty
                        ? ActionType.key
                        : ActionType.keyCombo,
                    key: _capturedKey,
                    modifiers: _modifiers.toList(),
                  )),
          child: const Text('Assign'),
        ),
      ],
    );
  }

  void _captureKey(RawKeyDownEvent event) {
    final key = _normalizeKey(event.logicalKey);
    if (key != null) {
      setState(() {
        _capturedKey = key;
        _listening = false;
        _modifiers = {
          if (event.isControlPressed) ModifierKey.control,
          if (event.isShiftPressed) ModifierKey.shift,
          if (event.isAltPressed) ModifierKey.alt,
          if (event.isMetaPressed) ModifierKey.meta,
        };
      });
    }
  }

  String? _normalizeKey(LogicalKeyboardKey key) {
    const map = {
      LogicalKeyboardKey.arrowUp: 'up',
      LogicalKeyboardKey.arrowDown: 'down',
      LogicalKeyboardKey.arrowLeft: 'left',
      LogicalKeyboardKey.arrowRight: 'right',
      LogicalKeyboardKey.space: 'space',
      LogicalKeyboardKey.enter: 'return',
      LogicalKeyboardKey.escape: 'escape',
      LogicalKeyboardKey.tab: 'tab',
      LogicalKeyboardKey.backspace: 'backspace',
      LogicalKeyboardKey.delete: 'delete',
      LogicalKeyboardKey.home: 'home',
      LogicalKeyboardKey.end: 'end',
      LogicalKeyboardKey.pageUp: 'pageup',
      LogicalKeyboardKey.pageDown: 'pagedown',
    };
    if (map.containsKey(key)) return map[key];
    final label = key.keyLabel;
    if (label.length == 1) return label.toLowerCase();
    if (RegExp(r'^F\d{1,2}$').hasMatch(label)) return label.toLowerCase();
    return null;
  }

  String _formatKey() {
    final parts = [
      ..._modifiers.map((m) => _capitalize(m.name)),
      _capturedKey!,
    ];
    return parts.join('+');
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
```

### 9.8 Update Banner

```dart
// lib/ui/components/update_banner.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/updater_providers.dart';
import '../../models/update_status.dart';

class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(updateStatusProvider);
    if (status.state == UpdateState.idle ||
        status.state == UpdateState.checking) {
      return const SizedBox.shrink();
    }
    return MaterialBanner(
      content: Text(_message(status)),
      actions: [
        if (status.state == UpdateState.ready)
          TextButton(
            onPressed: () => ref.read(updaterServiceProvider).installUpdate(),
            child: const Text('Restart & Update'),
          ),
        if (status.state == UpdateState.available)
          TextButton(
            onPressed: () => ref.read(updaterServiceProvider).downloadUpdate(),
            child: const Text('Download'),
          ),
        TextButton(
          onPressed: () => ref.read(updateStatusProvider.notifier).dismiss(),
          child: const Text('Dismiss'),
        ),
      ],
    );
  }

  String _message(UpdateStatus status) => switch (status.state) {
    UpdateState.available  => 'Update ${status.version} available',
    UpdateState.downloading => 'Downloading... ${status.percent?.toStringAsFixed(0)}%',
    UpdateState.ready      => 'Update ready to install',
    UpdateState.error      => 'Update error: ${status.error}',
    _                      => '',
  };
}
```

---

## 10. App Entry & Lifecycle

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:window_manager/window_manager.dart';
import 'package:hotkey_manager/hotkey_manager.dart';
import 'app.dart';
import 'services/config_store.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await windowManager.ensureInitialized();
  await windowManager.waitUntilReadyToShow(
    const WindowOptions(
      size: Size(900, 650),
      minimumSize: Size(700, 500),
      title: 'JoyToKey',
      titleBarStyle: TitleBarStyle.hidden,
      backgroundColor: Color(0xFF1E1E2E),
    ),
    () async {
      await windowManager.show();
      await windowManager.focus();
    },
  );

  await hotKeyManager.unregisterAll();

  final configStore = ConfigStore();
  await configStore.init();

  runApp(ProviderScope(
    overrides: [
      configStoreProvider.overrideWithValue(configStore),
    ],
    child: const JoyToKeyApp(),
  ));
}

// lib/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';
import 'package:hotkey_manager/hotkey_manager.dart';
import 'providers/device_providers.dart';
import 'providers/profile_providers.dart';
import 'services/config_store.dart';
import 'ui/router.dart';
import 'ui/theme.dart';

class JoyToKeyApp extends ConsumerStatefulWidget {
  const JoyToKeyApp({super.key});

  @override
  ConsumerState<JoyToKeyApp> createState() => _JoyToKeyAppState();
}

class _JoyToKeyAppState extends ConsumerState<JoyToKeyApp>
    with WindowListener, TrayListener {

  @override
  void initState() {
    super.initState();
    windowManager.addListener(this);
    trayManager.addListener(this);
    _initTray();
    _registerGlobalHotkey();
    _restoreConnectedDevices();
  }

  @override
  void dispose() {
    windowManager.removeListener(this);
    trayManager.removeListener(this);
    super.dispose();
  }

  Future<void> _initTray() async {
    await trayManager.setIcon('assets/tray_icon.ico');
    await trayManager.setContextMenu(Menu(items: [
      MenuItem(label: 'Show', onClick: (_) => windowManager.show()),
      MenuItem.separator(),
      MenuItem(
        label: 'Quit',
        onClick: (_) async {
          ref.read(hidManagerProvider).stop();
          await trayManager.destroy();
          await windowManager.destroy();
        },
      ),
    ]));
  }

  Future<void> _registerGlobalHotkey() async {
    final config = await ref.read(configStoreProvider).getConfig();
    // Parse "Ctrl+Shift+J" → HotKey and register via hotkey_manager
    // Implementation depends on hotkey_manager's API for parsing combo strings
  }

  Future<void> _restoreConnectedDevices() async {
    final config = await ref.read(configStoreProvider).getConfig();
    final manager = ref.read(hidManagerProvider);
    final devices = manager.enumerate();
    for (final path in config.connectedDevicePaths) {
      final dev = devices.firstWhereOrNull((d) => d.path == path);
      if (dev != null) {
        await manager.openDevice(dev.path, dev.vendorId, dev.productId);
      }
    }
  }

  @override
  void onWindowClose() async {
    final config = await ref.read(configStoreProvider).getConfig();
    if (config.minimizeToTray) {
      await windowManager.hide();
    } else {
      ref.read(hidManagerProvider).stop();
      await windowManager.destroy();
    }
  }

  @override
  void onTrayIconMouseDown() => windowManager.show();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'JoyToKey',
      theme: joytokeyTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

---

## 11. Build & Distribution

### 11.1 Build Commands

```bash
# Code generation (models, providers)
dart run build_runner build --delete-conflicting-outputs

# Debug run
flutter run -d windows

# Release build
flutter build windows --release
# Output: build/windows/x64/runner/Release/
```

### 11.2 Bundle hidapi.dll via CMake

Clone hidapi into `windows/third_party/hidapi/` and add to `windows/CMakeLists.txt`:

```cmake
# Build hidapi
add_subdirectory(third_party/hidapi hidapi_build)

# Copy hidapi.dll next to the flutter executable
install(
  FILES $<TARGET_FILE:hidapi>
  DESTINATION ${INSTALL_BUNDLE_LIB_DIR}
  COMPONENT Runtime
)
```

### 11.3 Inno Setup Installer Script

```iss
[Setup]
AppName=JoyToKey
AppVersion=1.0.0
AppPublisher=Your Name
DefaultDirName={autopf}\JoyToKey
DefaultGroupName=JoyToKey
UninstallDisplayIcon={app}\joytokey.exe
OutputBaseFilename=JoyToKey-Setup-1.0.0
Compression=lzma2
SolidCompression=yes

[Files]
Source: "build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\JoyToKey"; Filename: "{app}\joytokey.exe"
Name: "{commondesktop}\JoyToKey"; Filename: "{app}\joytokey.exe"; Tasks: desktopicon

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked

[Run]
Filename: "{app}\joytokey.exe"; Description: "Launch JoyToKey"; Flags: postinstall nowait
```

### 11.4 Auto-Update via GitHub Releases

```dart
// lib/services/updater_service.dart
import 'package:auto_updater/auto_updater.dart';

class UpdaterService {
  static const _feedUrl =
      'https://github.com/YourOrg/joytokey/releases/latest/download/appcast.xml';

  Future<void> init() async {
    await autoUpdater.setFeedURL(_feedUrl);
    await autoUpdater.checkForUpdates();
  }

  Future<void> checkNow() => autoUpdater.checkForUpdates();
  Future<void> downloadUpdate() => autoUpdater.checkForUpdates();
  Future<void> installUpdate() => autoUpdater.performUpdate();
}
```

The `appcast.xml` file must be hosted at the release URL:

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>JoyToKey</title>
    <item>
      <title>Version 1.1.0</title>
      <sparkle:version>1.1.0</sparkle:version>
      <pubDate>Mon, 15 Jun 2026 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/YourOrg/joytokey/releases/download/v1.1.0/JoyToKey-Setup-1.1.0.exe"
        sparkle:version="1.1.0"
        type="application/octet-stream"
      />
    </item>
  </channel>
</rss>
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

```dart
// test/unit/hid_parser_test.dart
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:joytokey/platform/hid/hid_parser.dart';
import 'package:joytokey/platform/hid/device_descriptor.dart';
import 'package:joytokey/models/joystick_event.dart';

void main() {
  group('HidParser - WhizToys', () {
    late HidParser parser;

    setUp(() {
      parser = HidParser(DeviceDescriptor.getStrategy(0, 0, 'WTS2-jyt', ''));
    });

    test('parses button 0 press from bit 0', () {
      final events =
          parser.parse(Uint8List.fromList([0x01]), 'test/path');
      expect(events, hasLength(1));
      expect(events.first.type, JoystickEventType.button);
      expect(events.first.index, 0);
      expect(events.first.value, 1.0);
    });

    test('emits no events when state unchanged', () {
      final buf = Uint8List.fromList([0x01]);
      parser.parse(buf, 'test/path');
      final second = parser.parse(buf, 'test/path');
      expect(second, isEmpty);
    });

    test('emits release event on transition 1→0', () {
      parser.parse(Uint8List.fromList([0x01]), 'test/path');
      final events =
          parser.parse(Uint8List.fromList([0x00]), 'test/path');
      expect(events, hasLength(1));
      expect(events.first.value, 0.0);
    });

    test('parses multiple simultaneous button presses', () {
      // bits 0 and 2 set = buttons 0 and 2
      final events =
          parser.parse(Uint8List.fromList([0x05]), 'test/path');
      expect(events, hasLength(2));
      expect(events.map((e) => e.index).toSet(), {0, 2});
    });
  });
}
```

```dart
// test/unit/mapping_engine_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:joytokey/services/mapping_engine.dart';
import 'package:joytokey/services/action_executor.dart';
import 'package:joytokey/services/dead_zone_filter.dart';
import 'package:joytokey/models/joystick_event.dart';
import 'package:joytokey/models/mapping.dart';
import 'package:joytokey/models/profile.dart';

class MockActionExecutor extends Mock implements ActionExecutor {}

void main() {
  late MappingEngine engine;
  late MockActionExecutor mockExecutor;

  setUp(() {
    mockExecutor = MockActionExecutor();
    engine = MappingEngine(mockExecutor, DeadZoneFilter());
    engine.setProfile(Profile(
      id: 'test', name: 'Test',
      createdAt: 0, updatedAt: 0,
      mappings: [
        const GamepadMapping(
          id: '1',
          trigger: InputTrigger(
            type: JoystickEventType.button,
            index: 0,
            condition: TriggerCondition.press,
          ),
          action: MappedAction(type: ActionType.key, key: 'space'),
        ),
      ],
    ));
  });

  test('fires action on button press', () {
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 0));
    verify(() => mockExecutor.execute(any(), true)).called(1);
  });

  test('does not re-fire on repeated press without release', () {
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 0));
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 1));
    verify(() => mockExecutor.execute(any(), any())).called(1);
  });

  test('fires again after release and re-press', () {
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 0));
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 0.0, rawValue: 0, timestamp: 1));
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 2));
    verify(() => mockExecutor.execute(any(), true)).called(2);
  });

  test('does not fire when engine is disabled', () {
    engine.setEnabled(false);
    engine.processEvent(const JoystickEvent(
      devicePath: 'p', type: JoystickEventType.button,
      index: 0, value: 1.0, rawValue: 1, timestamp: 0));
    verifyNever(() => mockExecutor.execute(any(), any()));
  });
}
```

```dart
// test/unit/dead_zone_filter_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:joytokey/services/dead_zone_filter.dart';
import 'package:joytokey/models/joystick_event.dart';

void main() {
  final filter = DeadZoneFilter();

  const axisEvent = JoystickEvent(
    devicePath: 'p', type: JoystickEventType.axis,
    index: 0, value: 0.0, rawValue: 0, timestamp: 0);

  test('snaps to center within default dead zone', () {
    final result = filter.apply(
        axisEvent.copyWith(value: 0.52), {'0': 0.1});
    expect(result.value, 0.5);
  });

  test('passes through value outside dead zone', () {
    final result = filter.apply(
        axisEvent.copyWith(value: 0.8), {'0': 0.1});
    expect(result.value, 0.8);
  });

  test('uses per-axis dead zone from profile', () {
    final result = filter.apply(
        axisEvent.copyWith(value: 0.65), {'0': 0.2});
    expect(result.value, 0.5);
  });
}
```

### 12.2 Widget Tests

```dart
// test/widget/key_assign_modal_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:joytokey/ui/components/key_assign_modal.dart';

void main() {
  testWidgets('shows prompt text before interaction', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: KeyAssignModal(title: 'Test')),
    ));
    expect(find.text('Click to capture key'), findsOneWidget);
    expect(find.text('Assign'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
  });

  testWidgets('Assign button is disabled before key capture', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: KeyAssignModal(title: 'Test')),
    ));
    final assignButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Assign'));
    expect(assignButton.onPressed, isNull);
  });

  testWidgets('shows current action if provided', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: KeyAssignModal(
          title: 'Test',
          currentAction: const MappedAction(
            type: ActionType.key, key: 'space'),
        ),
      ),
    ));
    expect(find.text('space'), findsOneWidget);
    expect(find.text('Clear'), findsOneWidget);
  });
}
```

---

## 13. Implementation Phases

| Phase | Scope | Deliverable |
|---|---|---|
| **1 — Foundation** | Project scaffold, models (freezed), ConfigStore, router, shell, theme | App opens, tabs navigate, config persists |
| **2 — HID Read** | hidapi.dll FFI bindings, HidManager, HidParser, device enumeration | Devices page lists connected gamepads live |
| **3 — Mapping Core** | MappingEngine, ActionExecutor (SendInput FFI), DeadZoneFilter, profiles CRUD | Button press injects keystroke on Windows |
| **4 — Grid UI** | DeviceGrid, GridTile, GridPage, KeyAssignModal | WhizToys tile click → key assign persists |
| **5 — Generic Mapping** | ButtonMap, ButtonCell, AxisGauge, MappingPage | Any gamepad: full button/axis/hat editor |
| **6 — Profiles & Settings** | ProfilesPage (CRUD, import/export), SettingsPage (hotkey, autostart, tray) | Multi-profile switching, global hotkey |
| **7 — System Integration** | System tray, minimize-to-tray, AutostartService, profile auto-switch | App behaves as a background utility |
| **8 — Distribution** | hidapi.dll in CMake, Inno Setup installer, auto_updater + GitHub Releases | One-click install, silent updates |
| **9 — Testing & Polish** | Full unit test coverage (parser, engine, store), widget tests, CI | Green CI on main |

---

## 14. Critical Production Concerns

### HID Permissions on Windows
No UAC elevation is required for HID Usage Page 1 (joystick/gamepad). Reads work without elevation. Keyboard/mouse HID devices require elevation or a kernel driver — don't try to read those.

### Isolate Safety for FFI
`DynamicLibrary` handles and `Pointer<T>` values are **not** transferable across Isolates. Initialize `HidBindings` inside the Isolate that uses it. Transfer the handle as a raw `int` address via `handle.address` / `Pointer.fromAddress(addr)`.

### Atomic Config Writes
The temp-file rename approach in `ConfigStore` prevents corrupt config on power loss. On Windows, `File.rename` within the same volume is atomic at the OS level.

### Dead Zone Hysteresis
`DeadZoneFilter` snaps to center and the `HidParser` only emits events on state change (`(value - prev).abs() > 0.001`). Together these prevent a constant flood of axis events when the stick rests near center.

### Key-Up Guarantee
When the app is paused, the window is closed, or a device disconnects, `MappingEngine._releaseAllHeld()` **must** be called to send `keyUp` for any `toggle: true` actions currently held down. Failure means the target application sees a key stuck permanently pressed.

### Single Instance Enforcement
Use a named mutex at startup to prevent multiple instances. With `window_manager`, check the mutex in `main()` before calling `runApp`:

```dart
// Windows: check named mutex before runApp
final mutex = CreateMutex(null, FALSE, 'JoyToKey_SingleInstance');
if (GetLastError() == ERROR_ALREADY_EXISTS) {
  // Bring existing window to front, then exit
  exit(0);
}
```

### Code-Signing
Sign both `joytokey.exe` and `hidapi.dll` with your EV code-signing certificate before distribution. Unsigned binaries trigger Windows SmartScreen warnings on first run and on every update.

### hidapi.dll ABI Compatibility
Build `hidapi.dll` targeting the same architecture as the Flutter app (`x64`). Ensure the same MSVC runtime version is used — or statically link the CRT (`/MT` instead of `/MD`) to avoid runtime DLL dependency issues on end-user machines.
