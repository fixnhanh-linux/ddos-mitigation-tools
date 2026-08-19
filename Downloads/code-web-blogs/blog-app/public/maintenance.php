<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website đang nâng cấp</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            animation: {
              'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
              'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              'spin': 'spin 1s linear infinite',
              'bounce': 'bounce 1s infinite',
            },
            keyframes: {
              ping: {
                '75%, 100%': { transform: 'scale(2)', opacity: '0' }
              },
              pulse: {
                '0%, 100%': { opacity: '1' },
                '50%': { opacity: '.5' }
              },
              spin: {
                'to': { transform: 'rotate(360deg)' }
              },
              bounce: {
                '0%, 100%': { transform: 'translateY(-25%)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
                '50%': { transform: 'none', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' }
              }
            }
          }
        }
      }
    </script>
</head>
<body class="min-h-screen flex items-center justify-center bg-slate-50 text-center px-4 font-sans m-0">
    <div class="max-w-xl w-full space-y-8 duration-700 opacity-100 transform scale-100 transition-all">
        <div class="relative w-full aspect-video mx-auto max-w-md">
            <!-- Tự vẽ SVG Hoạt hình bằng Code -->
            <svg viewBox="0 0 500 300" class="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
                <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#312e81" />
                    <stop offset="100%" stop-color="#1e1b4b" />
                </linearGradient>
                <linearGradient id="gradWire" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                </defs>

                <!-- Hào quang nền -->
                <circle cx="250" cy="150" r="100" fill="#4f46e5" class="animate-ping opacity-10" style="animation-duration: 3s;" />

                <!-- Server Bên Trái -->
                <rect x="40" y="50" width="120" height="200" rx="12" fill="url(#grad1)" stroke="#4f46e5" stroke-width="2" />
                <rect x="50" y="70" width="100" height="24" rx="4" fill="#1e293b" />
                <rect x="50" y="110" width="100" height="24" rx="4" fill="#1e293b" />
                <rect x="50" y="150" width="100" height="24" rx="4" fill="#1e293b" />
                <rect x="50" y="190" width="100" height="24" rx="4" fill="#1e293b" />

                <!-- Đèn nháy Server Trái -->
                <circle cx="135" cy="82" r="5" fill="#10b981" class="animate-pulse" style="animation-duration: 1s;" filter="url(#glow)" />
                <circle cx="135" cy="122" r="5" fill="#ef4444" class="animate-pulse" style="animation-duration: 0.5s;" filter="url(#glow)" />
                <circle cx="135" cy="162" r="5" fill="#3b82f6" class="animate-pulse" style="animation-duration: 2s;" filter="url(#glow)" />
                <circle cx="135" cy="202" r="5" fill="#10b981" class="animate-pulse" style="animation-duration: 1.5s;" />

                <!-- Server Bên Phải -->
                <rect x="340" y="50" width="120" height="200" rx="12" fill="url(#grad1)" stroke="#4f46e5" stroke-width="2" />
                <rect x="350" y="70" width="100" height="24" rx="4" fill="#1e293b" />
                <rect x="350" y="110" width="100" height="24" rx="4" fill="#1e293b" />
                <rect x="350" y="150" width="100" height="24" rx="4" fill="#1e293b" />

                <!-- Đèn nháy Server Phải -->
                <circle cx="435" cy="82" r="5" fill="#10b981" class="animate-pulse" style="animation-duration: 2s;" filter="url(#glow)" />
                <circle cx="435" cy="122" r="5" fill="#f59e0b" class="animate-pulse" style="animation-duration: 1.2s;" filter="url(#glow)" />
                <circle cx="435" cy="162" r="5" fill="#ef4444" class="animate-pulse" style="animation-duration: 0.8s;" filter="url(#glow)" />

                <!-- Dây điện bị đứt (Bên Trái) -->
                <path d="M 160 162 Q 210 162 230 170" fill="none" stroke="url(#gradWire)" stroke-width="12" stroke-linecap="round" class="animate-pulse" style="animation-duration: 1s;" />

                <!-- Dây điện bị đứt (Bên Phải) -->
                <path d="M 340 122 Q 290 122 260 140" fill="none" stroke="#ef4444" stroke-width="12" stroke-linecap="round" />

                <!-- Tia lửa điện (Sparks) -->
                <g class="animate-spin" style="animation-duration: 2s; transform-origin: 245px 155px;">
                <path d="M 245 145 L 250 130 L 255 145 L 270 150 L 255 155 L 250 170 L 245 155 L 230 150 Z" fill="#eab308" filter="url(#glow)" class="animate-pulse" style="animation-duration: 1.5s;" />
                <circle cx="235" cy="140" r="4" fill="#ef4444" class="animate-bounce" style="animation-duration: 1s;" />
                <circle cx="255" cy="170" r="5" fill="#3b82f6" class="animate-pulse" style="animation-duration: 0.5s;" filter="url(#glow)" />
                </g>

                <!-- Tua vít đang sửa (Screwdriver) -->
                <g class="animate-bounce" style="animation-duration: 2s; transform-origin: 250px 100px;">
                <!-- Thân tua vít -->
                <rect x="246" y="50" width="8" height="70" rx="2" fill="#94a3b8" />
                <!-- Cán tua vít -->
                <rect x="238" y="20" width="24" height="45" rx="6" fill="#f59e0b" />
                <rect x="238" y="30" width="24" height="5" fill="#d97706" />
                <rect x="238" y="45" width="24" height="5" fill="#d97706" />
                <!-- Đầu tua vít -->
                <path d="M 245 120 L 250 135 L 255 120 Z" fill="#cbd5e1" />
                </g>
            </svg>
        </div>
        <div class="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 relative z-10 mx-auto" style="max-width: 600px;">
            <h1 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4 inline-block">Website đang nâng cấp</h1>
            <p class="text-slate-600 leading-relaxed font-medium">Hệ thống của chúng tôi đang tiến hành đấu nối lại máy chủ và nâng cấp đường truyền. Vui lòng quay lại sau ít phút nhé!</p>
        </div>
    </div>
</body>
</html>
