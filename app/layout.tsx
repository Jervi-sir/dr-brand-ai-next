import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';
import NextAuthProvider from '@/components/next-auth-provider';
// import { Inter } from 'next/font/google'

// If loading a variable font, you don't need to specify the font weight
// const inter = Inter({
//   subsets: ['latin'],
//   display: 'swap',
// })

// const beiruti = Beiruti({
//   weight: ['200', '300', '400', '500', '600', '700', '800', '900' ],
//   subsets: ['arabic', 'latin'],
// })

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://huntproducts.online/'),
  title: 'Dr Brand ai',
  description: 'Dr Brand ai Here.',
};

export const viewport = {
  maximumScale: 1,
};

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // className={inter.className}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        {/* <script
          dangerouslySetInnerHTML={{
            __html: IN_APP_BROWSER_REDIRECT_SCRIPT,
          }}
        /> */}
      </head>
      <body className="subpixel-antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextAuthProvider>
            <Toaster position="top-center" />
            {children}
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;
const IN_APP_BROWSER_REDIRECT_SCRIPT = `\
(function () {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isInAppBrowser = (
    ua.includes('instagram') ||
    ua.includes('fban') || ua.includes('fbav') || // Facebook
    ua.includes('twitter') || // Twitter/X
    ua.includes('tiktok') || // TikTok
    ua.includes('wv') || // Generic WebView indicator
    (ua.includes('safari') === false && ua.includes('chrome') === false && ua.includes('firefox') === false)
  );

  if (isInAppBrowser) {
    const currentUrl = window.location.href;
    let externalUrl = currentUrl;

    if (isIOS) {
      externalUrl = 'x-safari-' + currentUrl;
    } else if (isAndroid) {
      externalUrl = currentUrl;
    }

    window.location.href = externalUrl;
  }
})();
`;
