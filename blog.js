document.addEventListener('DOMContentLoaded', () => {
    const tags = document.querySelectorAll('.tag');
    const posts = document.querySelectorAll('.post');

    // Etiket tıklama olayını dinle
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            // Aktif etiketi güncelle
            tags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');

            const selectedTag = tag.dataset.tag;

            // Yazıları filtrele
            posts.forEach(post => {
                if (selectedTag === 'all') {
                    post.style.display = 'block';
                } else {
                    const postTags = post.dataset.tags.split(',');
                    if (postTags.includes(selectedTag)) {
                        post.style.display = 'block';
                    } else {
                        post.style.display = 'none';
                    }
                }
            });
        });
    });
}); 