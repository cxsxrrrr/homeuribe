       //constantes no tocar
       
       const DATA_URL = 'data/cards.json';
        const IMAGE_ROOT = 'assets/cards/';
        const CARD_BACK_IMAGE = 'assets/back.png';
        const PLACEHOLDER_IMAGE = CARD_BACK_IMAGE;
        const MOBILE_QUERY = '(max-width: 540px)';
        const popularContainer = document.getElementById('popular-cards');
        const dealsContainer = document.getElementById('deal-cards');
        const searchInput = document.querySelector('.search-bar input');
        const searchButton = document.querySelector('.search-btn');
        const themeToggleInput = document.getElementById('theme-toggle');
        const headerContent = document.querySelector('.header-content');
        const headerFlex = document.querySelector('.header-flex');
        const menuToggleButton = document.querySelector('.menu-toggle');
        const carouselPrev = document.querySelector('.carousel-nav--prev');
        const carouselNext = document.querySelector('.carousel-nav--next');
        const SKELETONS_POPULAR = 6;
        const SKELETONS_DEALS = 4;
        const POPULAR_COUNT = 8;
        const DEALS_COUNT = 4;
        const MAX_VISIBLE_ITEMS = 5;
        const ROTATE_INTERVAL_MS = 12000;
        const raritySymbols = {
            Common: '●',
            Uncommon: '◆',
            Rare: '★',
            'Rare Holo': '★',
            'Rare Holo EX': '★',
            'Rare Holo GX': '★',
            'Rare Holo V': '★',
            'Rare Secret': '★',
            'Rare Ultra': '★',
            'Black White Rare': '★',
            'Illustration Rare': '◆'
        };

        // objeto que simula precios
        const rarityBasePrices = {
            Common: 1.5,
            Uncommon: 3,
            Rare: 8,
            'Illustration Rare': 18,
            'Ultra Rare': 24,
            'Special Illustration Rare': 36,
            'Black White Rare': 42
        };

        const formatCurrency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(value);

        const toNumber = (value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };

        let catalog = [];
        let catalogPromise = null;
        let lastQuery = '';
        let carouselIndex = 0;
        let rotationTimer = null;
        let currentSourceCards = [];
        const mobileMediaQuery = window.matchMedia(MOBILE_QUERY);
        const THEME_KEY = 'pokemart-theme';

        const applyTheme = (theme) => {
            const isDark = theme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            if (themeToggleInput) {
                themeToggleInput.checked = isDark;
            }
        };

        const loadSavedTheme = () => {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'dark' || saved === 'light') {
                return saved;
            }
            return 'light';
        };

        const toggleTheme = () => {
            const next = themeToggleInput && themeToggleInput.checked ? 'dark' : 'light';
            applyTheme(next);
            localStorage.setItem(THEME_KEY, next);
        };

        const isMobileLayout = () => mobileMediaQuery.matches;

        const uniqueArray = (values = []) => Array.from(new Set(values.filter(Boolean)));
        
        const computeDeterministicOffset = (text) => {
            if (!text) {
                return 0;
            }
            let hash = 7;
            for (let index = 0; index < text.length; index += 1) {
                hash = (hash * 31 + text.charCodeAt(index)) % 1000;
            }
            return hash / 100; // 0.00 - 9.99
        };

        const getIdPieces = (cardId) => {
            if (!cardId) {
                return { setId: null, number: null };
            }
            const [setId, rawNumber] = cardId.split('-');
            if (!setId || !rawNumber) {
                return { setId: null, number: null };
            }
            const cleanedNumber = rawNumber.replace(/^[A-Za-z]+/, '');
            return { setId: setId.toLowerCase(), number: cleanedNumber };
        };

        const buildImageCandidates = (card) => {
            if (!card?.id) {
                return [PLACEHOLDER_IMAGE];
            }

            const basePath = `${IMAGE_ROOT}${card.id}`;
            const candidates = [
                `${basePath}.png`,
                `${basePath}.jpg`,
                `${basePath}.jpeg`,
                `${basePath}.webp`
            ];
            candidates.push(PLACEHOLDER_IMAGE);
            return uniqueArray(candidates);
        };

        const normalizeCard = (card) => {
            const priceValue = toNumber(card?.price ?? card?.priceEUR ?? card?.priceUsd);
            const setName = card?.set?.name || card?.setName || 'Colección local';
            const rarity = card?.rarity || 'Rare';
            const basePrice = rarityBasePrices[rarity] ?? 12;
            const deterministicOffset = computeDeterministicOffset(card?.id || card?.name);
            const estimatedPrice = Number((basePrice + deterministicOffset).toFixed(2));
            return {
                ...card,
                set: card?.set?.name ? card.set : { name: setName },
                price: priceValue || estimatedPrice,
                imageCandidates: buildImageCandidates(card)
            };
        };

        const ensureCatalog = async () => {
            if (catalog.length) {
                return catalog;
            }

            if (!catalogPromise) {
                catalogPromise = fetch(DATA_URL, { cache: 'no-store' })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('No se pudo cargar el catálogo local');
                        }
                        return response.json();
                    })
                    .then((payload) => {
                        const cards = Array.isArray(payload?.data) ? payload.data : [];
                        catalog = cards.map(normalizeCard);
                        return catalog;
                    })
                    .catch((error) => {
                        catalogPromise = null;
                        throw error;
                    });
            }

            return catalogPromise;
        };

        const clearRotationTimer = () => {
            if (rotationTimer) {
                clearInterval(rotationTimer);
                rotationTimer = null;
            }
        };

        const disableCarouselNav = () => {
            if (carouselPrev) {
                carouselPrev.disabled = true;
            }
            if (carouselNext) {
                carouselNext.disabled = true;
            }
        };

        const updateCarouselTransforms = () => {
            if (!popularContainer || popularContainer.dataset.state !== 'ready') {
                disableCarouselNav();
                return;
            }

            const cards = Array.from(popularContainer.querySelectorAll('.card-item'));
            const total = cards.length;
            if (!total) {
                disableCarouselNav();
                return;
            }

            if (isMobileLayout()) {
                disableCarouselNav();
                cards.forEach((card) => {
                    card.dataset.hidden = 'false';
                    card.style.transform = 'none';
                    card.style.opacity = '1';
                    card.style.zIndex = '';
                    card.style.visibility = 'visible';
                    card.style.pointerEvents = 'auto';
                    card.classList.remove('is-center');
                });
                return;
            }

            if (carouselIndex >= total) {
                carouselIndex = 0;
            }

            if (carouselPrev) {
                carouselPrev.disabled = total <= 1;
            }
            if (carouselNext) {
                carouselNext.disabled = total <= 1;
            }

            const visibleWindow = Math.min(MAX_VISIBLE_ITEMS, total);
            const threshold = Math.floor(visibleWindow / 2);

            cards.forEach((card, idx) => {
                const rawOffset = idx - carouselIndex;
                let offset = rawOffset;
                if (offset > total / 2) {
                    offset -= total;
                }
                if (offset < -total / 2) {
                    offset += total;
                }

                const absOffset = Math.abs(offset);
                const hidden = absOffset > threshold && total > visibleWindow;
                card.dataset.hidden = hidden ? 'true' : 'false';

                const translateX = offset * 12;
                const translateZ = -Math.min(absOffset * 160, 720);
                const rotateY = offset * -12;
                const scale = Math.max(0.6, 1 - absOffset * 0.15);
                const opacity = hidden ? 0 : Math.max(0.25, 1 - absOffset * 0.25);

                card.style.transform = `translateX(-50%) translateX(${translateX}rem) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
                card.style.opacity = opacity.toString();
                card.style.zIndex = String(100 - absOffset * 10);
                card.style.visibility = hidden ? 'hidden' : 'visible';
                card.classList.toggle('is-center', offset === 0);
                card.style.pointerEvents = absOffset <= 1 ? 'auto' : 'none';
            });
        };

        const moveCarousel = (direction) => {
            if (isMobileLayout()) {
                return;
            }
            if (!popularContainer || popularContainer.dataset.state !== 'ready') {
                return;
            }
            const cards = popularContainer.querySelectorAll('.card-item');
            const total = cards.length;
            if (total <= 1) {
                return;
            }
            carouselIndex = (carouselIndex + direction + total) % total;
            updateCarouselTransforms();
        };

        const shuffleArray = (array) => {
            const copy = array.slice();
            for (let index = copy.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
            }
            return copy;
        };

        const pickRandomSubset = (cards, amount, exclusionSet = new Set()) => {
            const pool = cards.filter((card) => !exclusionSet.has(card?.id));
            const workingPool = pool.length ? pool : cards.slice();
            if (!workingPool.length) {
                return [];
            }
            const shuffled = shuffleArray(workingPool);
            const limit = Math.min(amount, shuffled.length);
            return shuffled.slice(0, limit);
        };

        const attachCardFlipInteraction = (cardElement, flipContainer) => {
            if (!cardElement || !flipContainer) {
                return;
            }

            if (!cardElement.dataset.rotation) {
                cardElement.dataset.rotation = '0';
            }

            cardElement.addEventListener('click', (event) => {
                if (event.target && event.target.closest('button')) {
                    return;
                }

                const nextRotation = Number(cardElement.dataset.rotation || '0') + 180;
                cardElement.dataset.rotation = String(nextRotation);
                flipContainer.style.transform = `rotateY(${nextRotation}deg)`;
            });
        };

        const createSkeletonCard = (options = {}) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'card-item skeleton-card' + (options.isCarousel ? ' carousel-item' : '');

            const image = document.createElement('div');
            image.className = 'card-img-container';
            const imageSkeleton = document.createElement('div');
            imageSkeleton.className = 'skeleton skeleton-img';
            image.appendChild(imageSkeleton);
            wrapper.appendChild(image);

            const info = document.createElement('div');
            info.className = 'card-info';

            const title = document.createElement('div');
            title.className = 'skeleton skeleton-title';
            info.appendChild(title);

            const line = document.createElement('div');
            line.className = 'skeleton skeleton-line';
            info.appendChild(line);

            const lineShort = document.createElement('div');
            lineShort.className = 'skeleton skeleton-line';
            lineShort.style.width = '60%';
            info.appendChild(lineShort);

            const pill = document.createElement('div');
            pill.className = 'skeleton skeleton-pill';
            info.appendChild(pill);

            wrapper.appendChild(info);
            return wrapper;
        };

        const getCardPrice = (card) => {
            const directPrice = toNumber(card?.price);
            if (directPrice && directPrice > 0) {
                return directPrice;
            }

            const marketPrice = toNumber(card?.cardmarket?.prices?.averageSellPrice);
            if (marketPrice && marketPrice > 0) {
                return marketPrice;
            }

            const priceGroups = card?.tcgplayer?.prices;
            if (!priceGroups) {
                return null;
            }

            for (const group of Object.values(priceGroups)) {
                const market = toNumber(group?.market);
                if (market && market > 0) {
                    return market;
                }
                const mid = toNumber(group?.mid);
                if (mid && mid > 0) {
                    return mid;
                }
            }

            return null;
        };

        const createCardElement = (card, options = {}) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'card-item' + (options.isCarousel ? ' carousel-item' : '');
            wrapper.dataset.hidden = 'false';
            if (card?.id) {
                wrapper.dataset.cardId = card.id;
            }
            const basePrice = toNumber(options.basePrice);
            let discountBadge = null;

            if (options.discountRate && basePrice) {
                discountBadge = document.createElement('div');
                discountBadge.className = 'discount-badge';
                discountBadge.textContent = `-${Math.round(options.discountRate * 100)}%`;
            }

            const imageContainer = document.createElement('div');
            imageContainer.className = 'card-img-container';

            const imageFlip = document.createElement('div');
            imageFlip.className = 'card-img-flip';

            const createFaceImage = (faceClass) => {
                const faceImage = document.createElement('img');
                faceImage.className = `card-img-face ${faceClass}`;
                faceImage.alt = card?.name || 'Carta Pokémon';
                faceImage.decoding = 'async';
                faceImage.loading = 'lazy';
                return faceImage;
            };

            const frontImage = createFaceImage('card-img-face--front');
            const backImage = createFaceImage('card-img-face--back');

            const imageCandidates = Array.isArray(card?.imageCandidates) && card.imageCandidates.length
                ? card.imageCandidates.slice()
                : [PLACEHOLDER_IMAGE];
            let currentImageIndex = 0;
            let handlingError = false;

            const applyImageSource = (source) => {
                frontImage.src = source;
            };

            const advanceImageCandidate = () => {
                if (currentImageIndex < imageCandidates.length - 1) {
                    currentImageIndex += 1;
                }
                applyImageSource(imageCandidates[currentImageIndex]);
            };

            const handleImageError = () => {
                if (handlingError) {
                    return;
                }
                handlingError = true;
                advanceImageCandidate();
                window.requestAnimationFrame(() => {
                    handlingError = false;
                });
            };

            frontImage.addEventListener('error', handleImageError);

            const handleBackImageError = () => {
                backImage.src = PLACEHOLDER_IMAGE;
                backImage.removeEventListener('error', handleBackImageError);
            };

            backImage.addEventListener('error', handleBackImageError);

            applyImageSource(imageCandidates[currentImageIndex]);
            backImage.src = CARD_BACK_IMAGE;

            imageFlip.appendChild(frontImage);
            imageFlip.appendChild(backImage);
            imageContainer.appendChild(imageFlip);
            if (discountBadge) {
                imageContainer.appendChild(discountBadge);
            }
            wrapper.appendChild(imageContainer);

            const info = document.createElement('div');
            info.className = 'card-info';

            const title = document.createElement('h3');
            title.textContent = card?.name || 'Carta Pokémon';
            info.appendChild(title);

            const setInfo = document.createElement('div');
            setInfo.className = 'card-set';
            const rarityIcon = document.createElement('span');
            rarityIcon.className = 'rarity-icon';
            const rarity = card?.rarity || 'Rare';
            rarityIcon.textContent = raritySymbols[rarity] || '★';
            setInfo.appendChild(rarityIcon);
            setInfo.appendChild(document.createTextNode(card?.set?.name || 'Colección local'));
            info.appendChild(setInfo);

            let displayedPrice = basePrice;

            if (basePrice && options.discountRate) {
                displayedPrice = basePrice * (1 - options.discountRate);
            }

            const priceElement = document.createElement('div');
            priceElement.className = 'card-price';
            if (card?.id) {
                priceElement.dataset.cardId = card.id;
            }
            if (displayedPrice) {
                priceElement.textContent = formatCurrency(displayedPrice);
                if (basePrice && options.discountRate) {
                    const oldPrice = document.createElement('span');
                    oldPrice.className = 'old-price';
                    oldPrice.textContent = formatCurrency(basePrice);
                    priceElement.appendChild(document.createTextNode(' '));
                    priceElement.appendChild(oldPrice);
                }
            } else {
                priceElement.textContent = 'N/D';
            }
            info.appendChild(priceElement);

            const button = document.createElement('button');
            button.className = 'add-to-cart';
            button.textContent = options.ctaLabel || 'Añadir al carrito';
            info.appendChild(button);
            attachCardFlipInteraction(wrapper, imageFlip);

            wrapper.appendChild(info);
            return wrapper;
        };

        const renderPopular = (cards) => {
            popularContainer.innerHTML = '';
            popularContainer.dataset.count = String(cards.length);

            if (!cards.length) {
                popularContainer.dataset.state = 'empty';
                disableCarouselNav();
                popularContainer.innerHTML = '<p class="status-message error">No se encontraron cartas populares.</p>';
                return;
            }

            popularContainer.dataset.state = 'ready';

            cards.forEach((card) => {
                const basePrice = getCardPrice(card);
                const element = createCardElement(card, {
                    isCarousel: true,
                    basePrice,
                    ctaLabel: 'Añadir al carrito'
                });
                popularContainer.appendChild(element);
            });

            carouselIndex = 0;
            updateCarouselTransforms();
            requestAnimationFrame(updateCarouselTransforms);
        };

        const renderDeals = (cards) => {
            dealsContainer.innerHTML = '';
            if (!cards.length) {
                dealsContainer.innerHTML = '<p class="status-message error">No se encontraron ofertas.</p>';
                return;
            }

            const discounts = [0.15, 0.2, 0.25, 0.3];
            cards.forEach((card, index) => {
                const basePrice = getCardPrice(card);
                const discountRate = discounts[index % discounts.length];
                const element = createCardElement(card, {
                    basePrice,
                    discountRate,
                    ctaLabel: '¡Comprar oferta!'
                });
                dealsContainer.appendChild(element);
            });
        };

        const showError = (message) => {
            const content = `<p class="status-message error">${message}</p>`;
            popularContainer.dataset.state = 'error';
            popularContainer.dataset.count = '0';
            disableCarouselNav();
            popularContainer.innerHTML = content;
            dealsContainer.innerHTML = content;
            clearRotationTimer();
        };

        const showSkeletons = () => {
            if (popularContainer) {
                popularContainer.dataset.state = 'loading';
                popularContainer.dataset.count = '0';
                disableCarouselNav();
                popularContainer.innerHTML = '';
            }
            if (dealsContainer) {
                dealsContainer.innerHTML = '';
            }
            clearRotationTimer();
            currentSourceCards = [];

            for (let index = 0; index < SKELETONS_POPULAR; index += 1) {
                popularContainer.appendChild(createSkeletonCard({ isCarousel: true }));
            }

            for (let index = 0; index < SKELETONS_DEALS; index += 1) {
                dealsContainer.appendChild(createSkeletonCard());
            }
        };

        const filterCards = (cards, term) => {
            if (!term) {
                return cards;
            }
            const loweredTerm = term.toLowerCase();
            return cards.filter((card) => {
                const nameMatch = card?.name?.toLowerCase().includes(loweredTerm);
                const idMatch = card?.id?.toLowerCase().includes(loweredTerm);
                return nameMatch || idMatch;
            });
        };

        const applyRandomSelections = (sourceCards) => {
            if (!Array.isArray(sourceCards) || !sourceCards.length) {
                renderPopular([]);
                renderDeals([]);
                return;
            }

            const popularSelection = pickRandomSubset(sourceCards, POPULAR_COUNT);
            const exclusion = new Set(popularSelection.map((card) => card?.id));
            const dealsSelection = pickRandomSubset(sourceCards, DEALS_COUNT, exclusion);

            renderPopular(popularSelection);
            renderDeals(dealsSelection);
        };

        const scheduleRotation = () => {
            clearRotationTimer();
            // Automatic rotation disabled; randomness now occurs only on load/search.
        };

        const loadCards = async (term = '') => {
            const normalizedTerm = term.trim();
            if (
                normalizedTerm === lastQuery &&
                popularContainer.children.length > 0 &&
                !popularContainer.querySelector('.skeleton-card') &&
                !popularContainer.querySelector('.status-message')
            ) {
                return;
            }

            lastQuery = normalizedTerm;
            showSkeletons();

            try {
                const cards = await ensureCatalog();
                const filtered = filterCards(cards, normalizedTerm);

                if (!filtered.length) {
                    showError('No se encontraron cartas con ese criterio.');
                    return;
                }

                currentSourceCards = filtered.slice();
                applyRandomSelections(currentSourceCards);
                scheduleRotation();
            } catch (error) {
                console.error(error);
                showError('No se pudo cargar el catálogo local.');
            }
        };

        const handleSearch = () => {
            loadCards(searchInput ? searchInput.value : '');
        };

        document.addEventListener('DOMContentLoaded', () => {
            const savedTheme = loadSavedTheme();
            applyTheme(savedTheme);
            loadCards();
            if (searchButton) {
                searchButton.addEventListener('click', handleSearch);
            }
            if (searchInput) {
                searchInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSearch();
                    }
                });
            }
            if (themeToggleInput) {
                themeToggleInput.addEventListener('change', toggleTheme);
            }
            if (carouselPrev) {
                carouselPrev.addEventListener('click', () => moveCarousel(-1));
            }
            if (carouselNext) {
                carouselNext.addEventListener('click', () => moveCarousel(1));
            }

            let closeHeaderMenu = () => {};
            if (menuToggleButton && headerContent && headerFlex) {
                const setMenuOpen = (open) => {
                    menuToggleButton.setAttribute('aria-expanded', String(open));
                    menuToggleButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
                    headerContent.classList.toggle('menu-open', open);
                    headerFlex.setAttribute('aria-hidden', String(!open));
                };

                closeHeaderMenu = () => setMenuOpen(false);
                setMenuOpen(false);

                menuToggleButton.addEventListener('click', () => {
                    const expanded = menuToggleButton.getAttribute('aria-expanded') === 'true';
                    setMenuOpen(!expanded);
                });

                document.addEventListener('click', (event) => {
                    if (!headerContent.contains(event.target)) {
                        closeHeaderMenu();
                    }
                });

                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        closeHeaderMenu();
                    }
                });
            }

            const handleLayoutChange = () => {
                requestAnimationFrame(updateCarouselTransforms);
                closeHeaderMenu();
            };

            window.addEventListener('resize', handleLayoutChange);

            if (typeof mobileMediaQuery.addEventListener === 'function') {
                mobileMediaQuery.addEventListener('change', handleLayoutChange);
            } else if (typeof mobileMediaQuery.addListener === 'function') {
                mobileMediaQuery.addListener(handleLayoutChange);
            }
        });