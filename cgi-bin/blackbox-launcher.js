'use strict';

// JSH 런타임에서 실행됨. bbox/bin/neo-blackbox 을 config 와 함께 기동.
// Linux / macOS / Windows 공통 지원.

var process = require('process');
var pathLib = require('path');
var os = require('os');
var fs = require('fs');

var IS_WIN = os.platform() === 'windows';
var posix = pathLib;
var hostPath = IS_WIN ? pathLib.win32 : pathLib;
var BIN_NAME = IS_WIN ? 'neo-blackbox.exe' : 'neo-blackbox';

// ── JSH 가상경로 (POSIX 고정) ──
var SCRIPT_DIR = posix.resolve(posix.dirname(process.argv[1]));   // /work/.../cgi-bin
var BBOX_DIR = posix.join(SCRIPT_DIR, 'bbox');                    // /work/.../cgi-bin/bbox

// ── 호스트 경로 변환 ──
var hostWorkDir = hostPath.dirname(process.execPath);
var relFromWork = BBOX_DIR.replace(/^\/work\//, '');
var hostBboxDir = hostPath.join(hostWorkDir, relFromWork);
var executable = hostPath.join(hostBboxDir, 'bin', BIN_NAME);
var configFile = hostPath.join(hostBboxDir, 'config', 'config.yaml');

console.println('launching:', executable);
console.println('config:', configFile);
console.println('cwd:', hostBboxDir);

var exitCode;
if (IS_WIN) {
  // launcher 자체가 죽으면 자식 트리 (neo-blackbox + mediamtx + ffmpeg + ai-manager + watcher) 도 같이 죽도록
  // Win32 JobObject 로 묶는다. KILL_ON_JOB_CLOSE 설정 시 PowerShell 프로세스가 어떤 식으로 죽든 (graceful 이든
  // service.stop 의 TerminateProcess 든) 커널이 job 핸들 정리하면서 job 의 모든 프로세스를 함께 종료한다.
  // Windows 8+ 부터 자식 프로세스는 부모의 job 을 자동으로 상속받으므로, neo-blackbox 가 자손을 spawn 해도
  // 모두 같은 job 에 들어간다. 안 묶으면: TerminateProcess 시 자손이 stdout/stderr 파이프 핸들 들고 살아남아
  // JSH controller 의 cmd.Wait() 가 EOF 못 받고 영원히 블락 → JSH 먹통.
  var ps1Virtual = posix.join(BBOX_DIR, '_launch.ps1');
  var ps1Host = hostPath.join(hostBboxDir, '_launch.ps1');
  var ps1Content = [
    "$ErrorActionPreference = 'Stop'",
    "",
    // single-quoted here-string (@'...'@) 안에는 변수 보간 없이 raw C# 코드만 들어감
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class Job {",
    "  [DllImport(\"kernel32.dll\", CharSet=CharSet.Unicode)]",
    "  public static extern IntPtr CreateJobObject(IntPtr a, string lpName);",
    "  [DllImport(\"kernel32.dll\")]",
    "  public static extern bool SetInformationJobObject(IntPtr h, int c, IntPtr p, uint l);",
    "  [DllImport(\"kernel32.dll\", SetLastError=true)]",
    "  public static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);",
    "  [DllImport(\"kernel32.dll\")]",
    "  public static extern IntPtr GetCurrentProcess();",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  public struct IO_COUNTERS {",
    "    public ulong R; public ulong W; public ulong O;",
    "    public ulong RT; public ulong WT; public ulong OT;",
    "  }",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  public struct BASIC_LIMIT {",
    "    public Int64 PerProcessUserTimeLimit;",
    "    public Int64 PerJobUserTimeLimit;",
    "    public UInt32 LimitFlags;",
    "    public UIntPtr MinimumWorkingSetSize;",
    "    public UIntPtr MaximumWorkingSetSize;",
    "    public UInt32 ActiveProcessLimit;",
    "    public UIntPtr Affinity;",
    "    public UInt32 PriorityClass;",
    "    public UInt32 SchedulingClass;",
    "  }",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  public struct EXTENDED_LIMIT {",
    "    public BASIC_LIMIT basic;",
    "    public IO_COUNTERS io;",
    "    public UIntPtr ProcessMemoryLimit;",
    "    public UIntPtr JobMemoryLimit;",
    "    public UIntPtr PeakProcessMemoryUsed;",
    "    public UIntPtr PeakJobMemoryUsed;",
    "  }",
    "}",
    "'@",
    "",
    "$KILL_ON_JOB_CLOSE = 0x2000",
    "$EXTENDED_INFO_CLASS = 9",
    "",
    "$job = [Job]::CreateJobObject([IntPtr]::Zero, $null)",
    "if ($job -eq [IntPtr]::Zero) { throw 'CreateJobObject failed' }",
    "",
    "$info = New-Object Job+EXTENDED_LIMIT",
    "$info.basic.LimitFlags = $KILL_ON_JOB_CLOSE",
    "$size = [System.Runtime.InteropServices.Marshal]::SizeOf($info)",
    "$ptr  = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)",
    "try {",
    "  [System.Runtime.InteropServices.Marshal]::StructureToPtr($info, $ptr, $false)",
    "  if (-not [Job]::SetInformationJobObject($job, $EXTENDED_INFO_CLASS, $ptr, $size)) {",
    "    throw 'SetInformationJobObject failed'",
    "  }",
    "} finally {",
    "  [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)",
    "}",
    "",
    "if (-not [Job]::AssignProcessToJobObject($job, [Job]::GetCurrentProcess())) {",
    "  throw 'AssignProcessToJobObject failed'",
    "}",
    "",
    "Set-Location -LiteralPath \"" + hostBboxDir + "\"",
    "& \"" + executable + "\" -config \"" + configFile + "\" -web",
    "exit $LASTEXITCODE",
  ].join('\r\n') + '\r\n';
  fs.writeFileSync(ps1Virtual, ps1Content);
  exitCode = process.exec('@powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Host);
} else {
  var script = 'cd "' + hostBboxDir + '" && exec "' + executable + '" -config "' + configFile + '" -web';
  exitCode = process.exec('@/bin/sh', '-c', script);
}
process.exit(exitCode);
