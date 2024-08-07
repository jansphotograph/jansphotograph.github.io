const menuButton = document.getElementById("#menu-resp");
const navBar = document.querySelector('.nav-bar');

menuButton.addEventListener('onClick', () => {
    navBar.classList.toggle('visible'); // O 'active', 'visible', etc. según tu CSS
});