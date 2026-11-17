// A script that runs before the first paint, in the root layout's <head>: it marks
// <html data-site="…"> with the platform of the page, or, on a product-wide
// page, the platform the reader chose last, so the header shows that
// platform's tabs from the start (app/navigation.css). Browser storage only;
// with none, no platform's tabs show.
import { platformIds } from "./platforms";

/** The script's source, for a <script> before the header. */
export function siteScript(): string {
  const ids = JSON.stringify(platformIds);
  return `(function(){try{var ids=${ids};var m=/^\\/docs\\/([a-z]+)(?:\\/|$)/.exec(location.pathname);var id=m&&ids.indexOf(m[1])>-1?m[1]:null;if(!id){var s=null;try{s=localStorage.getItem("ingestron-platform")}catch(e){}if(s&&ids.indexOf(s)>-1)id=s}if(id)document.documentElement.dataset.site=id}catch(e){}})();`;
}
