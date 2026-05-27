#Requires -Version 5.1
# Windows key injector — stdin-line protocol compatible with cgkey (macOS)
# Commands: keydown <key> [mods...]  keyup <key> [mods...]  keypress <key> [mods...]  mouseclick <button>

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class KeyInject {
    const int INPUT_KEYBOARD = 1;
    const int INPUT_MOUSE    = 0;
    const uint KEYEVENTF_KEYUP      = 0x0002;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN  = 0x0002;
    const uint MOUSEEVENTF_LEFTUP    = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP   = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN= 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP  = 0x0040;

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT {
        public int dx, dy;
        public uint mouseData, dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk, wScan;
        public uint dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT {
        public int type;
        public INPUTUNION u;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    static INPUT MakeKey(ushort vk, bool up) {
        var inp = new INPUT { type = INPUT_KEYBOARD };
        inp.u.ki.wVk = vk;
        inp.u.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0u;
        // extended keys: arrows, numpad, home/end/pgup/pgdn, ins/del, ralt/rctrl
        if (vk >= 0x21 && vk <= 0x2E) inp.u.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
        if (vk == 0xA1 || vk == 0xA3) inp.u.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY; // rshift/rctrl
        return inp;
    }

    public static void KeyDown(ushort vk) { SendInput(1, new[] { MakeKey(vk, false) }, Marshal.SizeOf(typeof(INPUT))); }
    public static void KeyUp(ushort vk)   { SendInput(1, new[] { MakeKey(vk, true) },  Marshal.SizeOf(typeof(INPUT))); }

    public static void MouseClick(string button) {
        uint down, up;
        switch (button) {
            case "right":  down = MOUSEEVENTF_RIGHTDOWN;  up = MOUSEEVENTF_RIGHTUP;  break;
            case "middle": down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; break;
            default:       down = MOUSEEVENTF_LEFTDOWN;   up = MOUSEEVENTF_LEFTUP;   break;
        }
        var inputs = new INPUT[2];
        inputs[0].type = INPUT_MOUSE; inputs[0].u.mi.dwFlags = down;
        inputs[1].type = INPUT_MOUSE; inputs[1].u.mi.dwFlags = up;
        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
'@

# Virtual key table — key name (lowercase) -> VK code
$VK = @{
    # Letters
    'a'=0x41;'b'=0x42;'c'=0x43;'d'=0x44;'e'=0x45;'f'=0x46;'g'=0x47;'h'=0x48
    'i'=0x49;'j'=0x4A;'k'=0x4B;'l'=0x4C;'m'=0x4D;'n'=0x4E;'o'=0x4F;'p'=0x50
    'q'=0x51;'r'=0x52;'s'=0x53;'t'=0x54;'u'=0x55;'v'=0x56;'w'=0x57;'x'=0x58
    'y'=0x59;'z'=0x5A
    # Digits
    '0'=0x30;'1'=0x31;'2'=0x32;'3'=0x33;'4'=0x34
    '5'=0x35;'6'=0x36;'7'=0x37;'8'=0x38;'9'=0x39
    # Function keys
    'f1'=0x70;'f2'=0x71;'f3'=0x72;'f4'=0x73;'f5'=0x74;'f6'=0x75
    'f7'=0x76;'f8'=0x77;'f9'=0x78;'f10'=0x79;'f11'=0x7A;'f12'=0x7B
    'f13'=0x7C;'f14'=0x7D;'f15'=0x7E;'f16'=0x7F;'f17'=0x80;'f18'=0x81
    'f19'=0x82;'f20'=0x83;'f21'=0x84;'f22'=0x85;'f23'=0x86;'f24'=0x87
    # Modifiers
    'shift'=0x10;'ctrl'=0x11;'alt'=0x12;'win'=0x5B
    'lshift'=0xA0;'rshift'=0xA1;'lctrl'=0xA2;'rctrl'=0xA3;'lalt'=0xA4;'ralt'=0xA5
    # Special
    'space'=0x20;'enter'=0x0D;'return'=0x0D;'escape'=0x1B;'esc'=0x1B
    'tab'=0x09;'backspace'=0x08;'delete'=0x2E;'del'=0x2E;'insert'=0x2D;'ins'=0x2D
    'home'=0x24;'end'=0x23;'pageup'=0x21;'pagedown'=0x22;'pgup'=0x21;'pgdn'=0x22
    'left'=0x25;'up'=0x26;'right'=0x27;'down'=0x28
    'capslock'=0x14;'numlock'=0x90;'scrolllock'=0x91;'printscreen'=0x2C
    'pause'=0x13;'apps'=0x5D
    # Punctuation / symbols
    'semicolon'=0xBA;'equal'=0xBB;'comma'=0xBC;'minus'=0xBD;'period'=0xBE
    'slash'=0xBF;'grave'=0xC0;'backslash'=0xDC;'leftbracket'=0xDB;'rightbracket'=0xDD
    'quote'=0xDE
    # Numpad
    'num0'=0x60;'num1'=0x61;'num2'=0x62;'num3'=0x63;'num4'=0x64
    'num5'=0x65;'num6'=0x66;'num7'=0x67;'num8'=0x68;'num9'=0x69
    'nummul'=0x6A;'numadd'=0x6B;'numsub'=0x6D;'numdec'=0x6E;'numdiv'=0x6F
}

$MOD_VKs = @{ 'shift'=0x10; 'ctrl'=0x11; 'alt'=0x12; 'win'=0x5B }

function Resolve-VK($name) {
    $n = $name.ToLower()
    if ($VK.ContainsKey($n)) { return [ushort]$VK[$n] }
    return $null
}

function Send-KeyDown($key, $mods) {
    foreach ($m in $mods) {
        $mvk = $MOD_VKs[$m.ToLower()]
        if ($mvk) { [KeyInject]::KeyDown([ushort]$mvk) }
    }
    $vk = Resolve-VK $key
    if ($vk) { [KeyInject]::KeyDown($vk) }
}

function Send-KeyUp($key, $mods) {
    $vk = Resolve-VK $key
    if ($vk) { [KeyInject]::KeyUp($vk) }
    foreach ($m in [Linq.Enumerable]::Reverse($mods)) {
        $mvk = $MOD_VKs[$m.ToLower()]
        if ($mvk) { [KeyInject]::KeyUp([ushort]$mvk) }
    }
}

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$stdin = [Console]::In

while ($true) {
    $line = $stdin.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ($line -eq '') { continue }

    $parts = $line -split '\s+'
    $cmd   = $parts[0].ToLower()
    $key   = if ($parts.Count -gt 1) { $parts[1] } else { '' }
    $mods  = if ($parts.Count -gt 2) { $parts[2..($parts.Count-1)] } else { @() }

    switch ($cmd) {
        'keydown'   { Send-KeyDown $key $mods }
        'keyup'     { Send-KeyUp   $key $mods }
        'keypress'  { Send-KeyDown $key $mods; Send-KeyUp $key $mods }
        'mouseclick'{ [KeyInject]::MouseClick($key) }
    }
}
