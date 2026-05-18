import Foundation
import CoreGraphics

// Mapping of human-readable key names to CGKeyCode (macOS virtual key codes)
let keyMap: [String: CGKeyCode] = [
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7,
    "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
    "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
    "5": 23, "equal": 24, "9": 25, "7": 26, "minus": 27, "8": 28,
    "0": 29, "rightbracket": 30, "o": 31, "u": 32, "leftbracket": 33,
    "i": 34, "p": 35, "return": 36, "l": 37, "j": 38, "quote": 39,
    "k": 40, "semicolon": 41, "backslash": 42, "comma": 43, "slash": 44,
    "n": 45, "m": 46, "period": 47, "tab": 48, "space": 49, "grave": 50,
    "delete": 51, "escape": 53, "command": 55, "shift": 56, "capslock": 57,
    "option": 58, "alt": 58, "control": 59, "rightshift": 60,
    "rightoption": 61, "rightcontrol": 62,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
    "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
    "f13": 105, "f14": 107, "f15": 113, "f16": 106, "f17": 64,
    "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
    "forwarddelete": 117, "help": 114,
    "left": 123, "right": 124, "down": 125, "up": 126,
    "keypad0": 82, "keypad1": 83, "keypad2": 84, "keypad3": 85,
    "keypad4": 86, "keypad5": 87, "keypad6": 88, "keypad7": 89,
    "keypad8": 91, "keypad9": 92, "keypadDecimal": 65,
    "keypadMultiply": 67, "keypadPlus": 69, "keypadMinus": 78,
    "keypadDivide": 75, "keypadEnter": 76, "keypadEquals": 81,
    "keypadClear": 71
]

func flagsForModifiers(_ mods: [String]) -> CGEventFlags {
    var flags: CGEventFlags = []
    for mod in mods {
        switch mod.lowercased() {
        case "shift": flags.insert(.maskShift)
        case "control", "ctrl": flags.insert(.maskControl)
        case "option", "alt": flags.insert(.maskAlternate)
        case "command", "cmd": flags.insert(.maskCommand)
        default: break
        }
    }
    return flags
}

func postKey(keyCode: CGKeyCode, down: Bool, flags: CGEventFlags) {
    let src = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: down) else {
        fputs("error: CGEvent creation failed\n", stderr)
        return
    }
    event.flags = flags
    event.post(tap: .cgSessionEventTap)
}

// Protocol (one command per line via stdin):
//   keydown <key> [modifier...]
//   keyup   <key> [modifier...]
//   keypress <key> [modifier...]
//   mouseclick <left|right|middle>
// Responds with "ok\n" on stdout after each command.
while let line = readLine() {
    let parts = line.trimmingCharacters(in: .whitespaces).components(separatedBy: " ").filter { !$0.isEmpty }
    guard !parts.isEmpty else { continue }
    let action = parts[0].lowercased()

    if action == "mouseclick" {
        let btn = parts.count > 1 ? parts[1].lowercased() : "left"
        let button: CGMouseButton = btn == "right" ? .right : btn == "middle" ? .center : .left
        let pos = CGEvent(source: nil)?.location ?? .zero
        let down = CGEvent(mouseEventSource: nil, mouseType: button == .right ? .rightMouseDown : .otherMouseDown, mouseCursorPosition: pos, mouseButton: button)
        let up   = CGEvent(mouseEventSource: nil, mouseType: button == .right ? .rightMouseUp : .otherMouseUp, mouseCursorPosition: pos, mouseButton: button)
        if button == .left {
            CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pos, mouseButton: .left)?.post(tap: .cgSessionEventTap)
            CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pos, mouseButton: .left)?.post(tap: .cgSessionEventTap)
        } else {
            down?.post(tap: .cgSessionEventTap)
            up?.post(tap: .cgSessionEventTap)
        }
        print("ok")
        fflush(stdout)
        continue
    }

    guard parts.count >= 2 else { print("ok"); fflush(stdout); continue }
    let keyName = parts[1].lowercased()
    let mods = Array(parts.dropFirst(2))

    guard let keyCode = keyMap[keyName] else {
        fputs("unknown key: \(keyName)\n", stderr)
        print("ok")
        fflush(stdout)
        continue
    }

    let flags = flagsForModifiers(mods)

    switch action {
    case "keydown":
        postKey(keyCode: keyCode, down: true, flags: flags)
    case "keyup":
        postKey(keyCode: keyCode, down: false, flags: flags)
    case "keypress":
        postKey(keyCode: keyCode, down: true, flags: flags)
        postKey(keyCode: keyCode, down: false, flags: flags)
    default:
        fputs("unknown action: \(action)\n", stderr)
    }

    print("ok")
    fflush(stdout)
}
