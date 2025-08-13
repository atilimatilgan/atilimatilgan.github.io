document.addEventListener("DOMContentLoaded", () => {
    // Load header
    const headerNav = document.querySelector("header .nav");
    if (headerNav) {
        // header.html'nin kök dizinde olduğunu varsayıyoruz.
        fetch('/header.html')
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
            .catch(error => console.error('Failed to fetch header:', error));
    }
});

// Intersection Observer ile bölümlere scroll animasyonu ekle
const sections = document.querySelectorAll('.section');
const observerOptions = {
    threshold: 0.1
};

const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
};

const observer = new IntersectionObserver(observerCallback, observerOptions);
sections.forEach(section => {
    observer.observe(section);
});

// PDF Download butonları için click event handler'lar
document.getElementById('cvDownload')?.addEventListener('click', () => {
    // Dinamik PDF önizleme veya indirme işlemleri burada uygulanabilir
    alert('CV indiriliyor (Türkçe)...');
});

document.getElementById('cvDownloadEng')?.addEventListener('click', () => {
    alert('Downloading CV (English)...');
});

// Günce için filtreleme kodu: yalnızca .post--preview öğeleri filtrelensin
const blogTags = document.querySelectorAll('.tag');
const postPreviews = document.querySelectorAll('.post--preview');

if (blogTags.length > 0 && postPreviews.length > 0) {
    blogTags.forEach(tagBtn => {
        tagBtn.addEventListener('click', () => {
            // Sayfa durumunu sıfırla
            resetPageState();

            // Etiket butonlarını güncelle
            blogTags.forEach(btn => btn.classList.remove('active'));
            tagBtn.classList.add('active');

            // Filtrelemeyi uygula
            filterPosts(tagBtn.getAttribute('data-tag'));
        });
    });
}

// Publications filtering code
const publicationTags = document.querySelectorAll('.tag');
const publicationItems = document.querySelectorAll('.publication');

if (publicationTags.length > 0 && publicationItems.length > 0) {
    publicationTags.forEach(tagBtn => {
        tagBtn.addEventListener('click', () => {
            publicationTags.forEach(btn => btn.classList.remove('active'));
            tagBtn.classList.add('active');
            
            const filter = tagBtn.getAttribute('data-tag');
            
            publicationItems.forEach(item => {
                const itemTags = item.getAttribute('data-tags');
                if (filter === 'all' || itemTags.includes(filter)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// Yardımcı fonksiyonlar: öğeyi gizle/göster
function hideElement(el) {
    el.classList.add('hidden');
}

function showElement(el) {
    el.classList.remove('hidden');
}

// Sayfa durumunu sıfırlama fonksiyonu
function resetPageState() {
    // Tüm tam metinleri gizle
    document.querySelectorAll('.post--full').forEach(post => {
        post.classList.add('hidden');
    });
    
    // Tüm özetleri göster
    document.querySelectorAll('.post--preview').forEach(preview => {
        preview.classList.remove('hidden');
    });
}

// Post filtreleme fonksiyonu
function filterPosts(filter) {
    postPreviews.forEach(item => {
        const itemTag = item.getAttribute('data-tag');
        if (filter === 'all' || itemTag === filter) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
    // Filtre uygulandıktan sonra tüm tam metin öğelerinin gizli olduğundan emin ol
    document.querySelectorAll('.post--full').forEach(post => {
        post.classList.add('hidden');
    });
}

function showFullPost(postId) {
    // Önce tüm özetleri ve tam metinleri gizle
    document.querySelectorAll('.post--preview').forEach(post => {
        post.classList.add('hidden');
    });
    document.querySelectorAll('.post--full').forEach(post => {
        post.classList.add('hidden');
    });

    // Sadece seçilen postun tam metnini göster
    document.getElementById(postId + '-full').classList.remove('hidden');
    window.scrollTo(0, 0);
} 