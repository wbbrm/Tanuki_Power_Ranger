param(
    [Parameter(Mandatory=$true)]
    [int]$ProcessId,

    [Parameter(Mandatory=$true)]
    [string]$Command
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class ConsoleInjector
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct KEY_EVENT_RECORD
    {
        public int bKeyDown;
        public ushort wRepeatCount;
        public ushort wVirtualKeyCode;
        public ushort wVirtualScanCode;
        public char UnicodeChar;
        public uint dwControlKeyState;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUT_RECORD
    {
        [FieldOffset(0)]
        public ushort EventType;

        [FieldOffset(4)]
        public KEY_EVENT_RECORD KeyEvent;
    }

    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool AttachConsole(uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateFileW(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(
        IntPtr hObject
    );

    public const uint GENERIC_READ = 0x80000000;
    public const uint GENERIC_WRITE = 0x40000000;

    public const uint FILE_SHARE_READ = 0x00000001;
    public const uint FILE_SHARE_WRITE = 0x00000002;

    public const uint OPEN_EXISTING = 3;

    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool WriteConsoleInputW(
        IntPtr hConsoleInput,
        INPUT_RECORD[] lpBuffer,
        uint nLength,
        out uint lpNumberOfEventsWritten
    );

    public const int STD_INPUT_HANDLE = -10;
    public const ushort KEY_EVENT = 0x0001;

    public const ushort VK_RETURN = 0x0D;
    public const ushort VK_BACK   = 0x08;
    public const ushort VK_SPACE  = 0x20;

    public const uint SHIFT_PRESSED = 0x0010;

    static void AddKey(
        ref INPUT_RECORD record,
        bool down,
        ushort vk,
        ushort scan,
        char unicode,
        uint control)
    {
        record.EventType = KEY_EVENT;
        record.KeyEvent.bKeyDown = down ? 1 : 0;
        record.KeyEvent.wRepeatCount = 1;
        record.KeyEvent.wVirtualKeyCode = vk;
        record.KeyEvent.wVirtualScanCode = scan;
        record.KeyEvent.UnicodeChar = unicode;
        record.KeyEvent.dwControlKeyState = control;
    }

    static void AddCharacter(
        System.Collections.Generic.List<INPUT_RECORD> list,
        char c)
    {
        ushort vk = 0;
        ushort scan = 0;
        uint control = 0;
        char unicode = c;

        // Letters
        if (c >= 'a' && c <= 'z')
        {
            vk = (ushort)char.ToUpper(c);
            scan = (ushort)MapVirtualKey(vk, 0);
        }
        else if (c >= 'A' && c <= 'Z')
        {
            vk = c;
            scan = (ushort)MapVirtualKey(vk, 0);
            control = SHIFT_PRESSED;
        }

        // Numbers
        else if (c >= '0' && c <= '9')
        {
            vk = c;
            scan = (ushort)MapVirtualKey(vk, 0);
        }

        // Common symbols
        else
        {
            switch (c)
            {
                case ' ':
                    vk = VK_SPACE;
                    scan = 0x39;
                    break;

                case '(':
                    vk = 0x39;       // 9
                    scan = 0x0A;
                    control = SHIFT_PRESSED;
                    break;

                case ')':
                    vk = 0x30;       // 0
                    scan = 0x0B;
                    control = SHIFT_PRESSED;
                    break;

                case '"':
                    vk = 0x32;       // 2
                    scan = 0x03;
                    control = SHIFT_PRESSED;
                    break;

                case '=':
                    vk = 0xBB;       // =
                    scan = 0x0D;
                    break;

                case '_':
                    vk = 0xBD;       // -
                    scan = 0x0C;
                    control = SHIFT_PRESSED;
                    break;

                case ':':
                    vk = 0xBA;       // ;
                    scan = 0x27;
                    control = SHIFT_PRESSED;
                    break;

                case '.':
                    vk = 0xBE;
                    scan = 0x34;
                    break;

                case ',':
                    vk = 0xBC;
                    scan = 0x33;
                    break;

                case '|':
                    vk = 0xDC;
                    scan = 0x2B;
                    control = SHIFT_PRESSED;
                    break;

                case '[':
                    vk = 0xDB;
                    scan = 0x1A;
                    break;

                case ']':
                    vk = 0xDD;
                    scan = 0x1B;
                    break;

                default:
                    // fallback: Unicode input
                    vk = 0;
                    scan = 0;
                    control = 0;
                    break;
            }
        }

        INPUT_RECORD down = new INPUT_RECORD();
        INPUT_RECORD up = new INPUT_RECORD();

        AddKey(
            ref down,
            true,
            vk,
            scan,
            unicode,
            control
        );

        AddKey(
            ref up,
            false,
            vk,
            scan,
            unicode,
            control
        );

        list.Add(down);
        list.Add(up);
    }

    [DllImport("user32.dll")]
    static extern uint MapVirtualKey(
        uint uCode,
        uint uMapType
    );

    public static void Send(int pid, string command)
    {
        FreeConsole();

        if (!AttachConsole((uint)pid))
        {
            throw new Exception(
                "AttachConsole failed. Win32 Error: " +
                Marshal.GetLastWin32Error()
            );
        }

        IntPtr input =
            CreateFileW(
                "CONIN$",
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                IntPtr.Zero,
                OPEN_EXISTING,
                0,
                IntPtr.Zero
            );

        if (input == IntPtr.Zero ||
            input == new IntPtr(-1))
        {
            int error =
                Marshal.GetLastWin32Error();

            FreeConsole();

            throw new Exception(
                "CreateFileW(CONIN$) failed. Win32 Error: " +
            error
            );
        }

        var records =
            new System.Collections.Generic.List<INPUT_RECORD>();

        foreach (char c in command)
        {
            AddCharacter(records, c);
        }

        // ENTER
        INPUT_RECORD enterDown = new INPUT_RECORD();

        AddKey(
            ref enterDown,
            true,
            VK_RETURN,
            0x1C,
            '\r',
            0
        );

        INPUT_RECORD enterUp = new INPUT_RECORD();

        AddKey(
            ref enterUp,
            false,
            VK_RETURN,
            0x1C,
            '\r',
            0
        );

        records.Add(enterDown);
        records.Add(enterUp);

        INPUT_RECORD[] events = records.ToArray();

        uint written;

        if (!WriteConsoleInputW(
            input,
            events,
            (uint)events.Length,
            out written))
        {
            int error =
                Marshal.GetLastWin32Error();

            CloseHandle(input);
            FreeConsole();

            throw new Exception(
                "WriteConsoleInputW failed. Win32 Error: " +
                error
            );
        }

        Console.WriteLine(
            "Sent " + written + " input events."
        );

        CloseHandle(input);

            FreeConsole();
        }
}

"@

try {

    [ConsoleInjector]::Send(
        $ProcessId,
        $Command
    )

    exit 0

}
catch {

    Write-Error $_ -ErrorAction Continue

    exit 1
}