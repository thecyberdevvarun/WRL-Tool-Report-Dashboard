# ADriverPrint.SendStringToPrinter: the string (ANSI code page, as Marshal.StringToCoTaskMemAnsi) sent as a RAW job
# named "TIM_LABEL_PRINT" to a Windows printer. Usage: raw-print.ps1 <printer name> <base64 of the UTF-8 text>
param([string]$Printer, [string]$Base64)
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)] static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)] static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)] static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)] static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)] static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)] static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)] static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string printer, string s) {
    IntPtr p = Marshal.StringToCoTaskMemAnsi(s);
    IntPtr h; int written = 0; bool ok = false;
    DOCINFOA di = new DOCINFOA(); di.pDocName = "TIM_LABEL_PRINT"; di.pDataType = "RAW";
    if (OpenPrinter(printer.Normalize(), out h, IntPtr.Zero)) {
      if (StartDocPrinter(h, 1, di)) {
        if (StartPagePrinter(h)) { ok = WritePrinter(h, p, s.Length, out written); EndPagePrinter(h); }
        EndDocPrinter(h);
      }
      ClosePrinter(h);
    }
    Marshal.FreeCoTaskMem(p);
    return ok;
  }
}
"@
[void][RawPrint]::Send($Printer, $text)
