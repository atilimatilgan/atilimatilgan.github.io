document.addEventListener("DOMContentLoaded", () => {
    // Load header for blog posts
    const headerNav = document.querySelector("header .nav");
    if (headerNav) {
        // Use blog post specific header
        fetch('post-header.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                headerNav.innerHTML = html;
                
                // Set active class for the current page link
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const navLinks = headerNav.querySelectorAll('.nav__link');
                
                navLinks.forEach(link => {
                    const linkPage = new URL(link.href).pathname.split('/').pop();
                    if (linkPage === currentPage) {
                        link.classList.add('active');
                    }
                });
            })
            .catch(error => {
                console.error('Failed to fetch header:', error);
            });
    }
});
