// Gallery module
(function(){
    function setupGallery() {
        const photos = document.querySelectorAll('.photo-item img');
        photos.forEach(photo => {
            photo.addEventListener('click', function() {
                // Placeholder for future lightbox implementation
            });
        });
    }

    document.addEventListener('DOMContentLoaded', setupGallery);
})();
