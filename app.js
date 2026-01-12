        const DATA_URL = 'data/cards.json';
        const IMAGE_ROOT = 'assets/cards/';
        const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/245x342/FFFFFF/E0E0E0?text=Pokemon+TCG';
        const popularContainer = document.getElementById('popular-cards');
        const dealsContainer = document.getElementById('deal-cards');
        const searchInput = document.querySelector('.search-bar input');
        const searchButton = document.querySelector('.search-btn');
        const SKELETONS_POPULAR = 6;
        const SKELETONS_DEALS = 4;
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

        const rarityBasePrices = {
            Common: 1.5,
            Uncommon: 3,
            Rare: 8,
            'Illustration Rare': 18,
            'Ultra Rare': 24,
            'Special Illustration Rare': 36,
            'Black White Rare': 42
        };

        const formatCurrency = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

        const toNumber = (value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };

        let catalog = [];
        let catalogPromise = null;
        let lastQuery = '';

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
            const candidates = [];
            if (card?.image) {
                candidates.push(card.image);
            }
            if (card?.images?.small) {
                candidates.push(card.images.small);
            }
            if (card?.images?.large) {
                candidates.push(card.images.large);
            }
            if (card?.id) {
                const basePath = `${IMAGE_ROOT}${card.id}`;
                candidates.push(
                    `${basePath}.png`,
                    `${basePath}.jpg`,
                    `${basePath}.jpeg`,
                    `${basePath}.webp`
                );

                const { setId, number } = getIdPieces(card.id);
                if (setId && number) {
                    candidates.push(
                        `https://images.pokemontcg.io/${setId}/${number}.png`,
                        `https://images.pokemontcg.io/${setId}/${number}_hires.png`
                    );
                }
            }
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
            if (card?.id) {
                wrapper.dataset.cardId = card.id;
            }
            const basePrice = toNumber(options.basePrice);

            if (options.discountRate && basePrice) {
                const discountBadge = document.createElement('div');
                discountBadge.className = 'discount-badge';
                discountBadge.textContent = `-${Math.round(options.discountRate * 100)}%`;
                wrapper.appendChild(discountBadge);
            }

            const imageContainer = document.createElement('div');
            imageContainer.className = 'card-img-container';
            const imageElement = document.createElement('img');
            const imageCandidates = Array.isArray(card?.imageCandidates) && card.imageCandidates.length ? card.imageCandidates : [PLACEHOLDER_IMAGE];
            let currentImageIndex = 0;
            imageElement.src = imageCandidates[currentImageIndex];
            imageElement.alt = card?.name || 'Carta Pokémon';
            imageElement.addEventListener('error', () => {
                currentImageIndex += 1;
                if (currentImageIndex < imageCandidates.length) {
                    imageElement.src = imageCandidates[currentImageIndex];
                }
            });
            imageContainer.appendChild(imageElement);
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
            button.textContent = options.ctaLabel || 'Añadir al Carrito';
            info.appendChild(button);

            wrapper.appendChild(info);
            return wrapper;
        };

        const renderPopular = (cards) => {
            popularContainer.innerHTML = '';
            if (!cards.length) {
                popularContainer.innerHTML = '<p class="status-message error">No se encontraron cartas populares.</p>';
                return;
            }

            cards.forEach((card) => {
                const basePrice = getCardPrice(card);
                const element = createCardElement(card, {
                    isCarousel: true,
                    basePrice,
                    ctaLabel: 'Añadir al Carrito'
                });
                popularContainer.appendChild(element);
            });
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
                    ctaLabel: '¡Comprar Oferta!'
                });
                dealsContainer.appendChild(element);
            });
        };

        const showError = (message) => {
            const content = `<p class="status-message error">${message}</p>`;
            popularContainer.innerHTML = content;
            dealsContainer.innerHTML = content;
        };

        const showSkeletons = () => {
            popularContainer.innerHTML = '';
            dealsContainer.innerHTML = '';

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

                renderPopular(filtered.slice(0, 8));
                renderDeals(filtered.slice(8, 12));
            } catch (error) {
                console.error(error);
                showError('No se pudo cargar el catálogo local.');
            }
        };

        const handleSearch = () => {
            loadCards(searchInput ? searchInput.value : '');
        };

        document.addEventListener('DOMContentLoaded', () => {
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
        });