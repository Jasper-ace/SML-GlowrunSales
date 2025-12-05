// 404 Handler - Redirect to 404.html for non-existent pages
(function() {
  // List of valid pages in your app
  const validPages = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/admin.html',
    '/summary.html',
    '/unautorized.html',
    '/create-favicon.html',
    '/404.html'
  ];

  // Get current path
  const currentPath = window.location.pathname;
  
  // Normalize path (remove trailing slash if present)
  const normalizedPath = currentPath.endsWith('/') && currentPath !== '/' 
    ? currentPath.slice(0, -1) 
    : currentPath;

  // Check if current page is valid
  const isValidPage = validPages.some(page => {
    // Handle root path
    if (normalizedPath === '/' || normalizedPath === '') return page === '/' || page === '/index.html';
    // Check exact match
    if (normalizedPath === page) return true;
    // Check without leading slash
    if (normalizedPath === page.substring(1)) return true;
    return false;
  });

  // Check if file exists (for assets, etc.)
  const isAssetOrKnownFile = 
    normalizedPath.includes('.css') ||
    normalizedPath.includes('.js') ||
    normalizedPath.includes('.png') ||
    normalizedPath.includes('.jpg') ||
    normalizedPath.includes('.jpeg') ||
    normalizedPath.includes('.gif') ||
    normalizedPath.includes('.svg') ||
    normalizedPath.includes('.ico') ||
    normalizedPath.includes('.mp4') ||
    normalizedPath.includes('.webm') ||
    normalizedPath.includes('/assets/') ||
    normalizedPath.includes('/.git/') ||
    normalizedPath.includes('/.vscode/');

  // If not a valid page and not an asset, redirect to 404
  if (!isValidPage && !isAssetOrKnownFile && currentPath !== '/404.html' && !currentPath.endsWith('/404.html')) {
    // Store the attempted URL for reference
    sessionStorage.setItem('attempted404Url', window.location.href);
    // Redirect to 404 page
    window.location.replace('/404.html');
  }
})();
