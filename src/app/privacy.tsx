import { SitePageWebView } from '@/shared/webview';

/** The site's privacy page, inside the app so its "Don't record my visits" switch applies here. */
export default function PrivacyRoute() {
  return <SitePageWebView path="/privacy.html" testID="privacy-webview" />;
}
