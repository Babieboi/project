// Firebase imports (using specific versions for compatibility)
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Global variables provided by the Canvas environment
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = {
                apiKey: "AIzaSyCralFFm6eMcBwTwzsnzS6cbGxP6c-06MA",
                authDomain: "nft-market-f5f35.firebaseapp.com",
                projectId: "nft-market-f5f35",
                storageBucket: "nft-market-f5f35.firebasestorage.app",
                messagingSenderId: "531506810595",
                appId: "1:531506810595:web:f6895a431814f6df17bfd6",
                measurementId: "G-TMQYKQ82K1"
            };

            
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        let app;
        let db;
        let auth;
        let currentUserId = null;
        let userBalance = 0; // Initialized to 0, will be fetched from Firestore or simulated
        let activeWalletType = 'firebase'; // 'firebase' or 'simulated'
        let simulatedWalletAddress = null;
        let simulatedWalletBalance = 0;
        let displayName = "Anonymous";

        // In-memory storage for NFTs (will be populated by Firestore listener)
        let nfts = [];

        // DOM Elements
        const nftNameInput = document.getElementById('nftName');
        const nftDescriptionInput = document.getElementById('nftDescription');
        const mintNftBtn = document.getElementById('mintNftBtn');
        const yourNftsContainer = document.getElementById('yourNftsContainer');
        const marketplaceContainer = document.getElementById('marketplaceContainer');
        const noYourNftsMessage = document.getElementById('noYourNfts');
        const noMarketplaceNftsMessage = document.getElementById('noMarketplaceNfts');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const displayNameInput = document.getElementById('displayNameInput');
        const saveDisplayNameBtn = document.getElementById('saveDisplayNameBtn');
        const activeWalletDisplay = document.getElementById('activeWalletDisplay');
        const userBalanceDisplay = document.getElementById('userBalanceDisplay');
        const connectSimulatedWalletBtn = document.getElementById('connectSimulatedWalletBtn');
        const useFirebaseWalletBtn = document.getElementById('useFirebaseWalletBtn');
        const messageBox = document.getElementById('messageBox');
        const loadingOverlay = document.getElementById('loadingOverlay');

        // Modal Elements
        const priceModal = document.getElementById('priceModal');
        const modalPriceInput = document.getElementById('modalPriceInput');
        const modalConfirmBtn = document.getElementById('modalConfirmBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');

        let resolveModalPromise; // To hold the resolve function for the modal promise

        /**
         * Displays a temporary message to the user.
         * @param {string} message - The message to display.
         * @param {boolean} isError - True if it's an error message, false for success.
         */
        function showMessage(message, isError = false) {
            messageBox.textContent = message;
            messageBox.className = 'message-box'; // Reset classes
            if (isError) {
                messageBox.classList.add('error');
            }
            messageBox.style.display = 'block';
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 3000); // Hide after 3 seconds
        }

        /**
         * Shows or hides the loading overlay.
         * @param {boolean} show - True to show, false to hide.
         */
        function toggleLoading(show) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }

        /**
         * Opens the price input modal and returns a promise that resolves with the price or null.
         * @returns {Promise<number|null>} The entered price or null if canceled.
         */
        function showPriceModal() {
            modalPriceInput.value = ''; // Clear previous input
            priceModal.style.display = 'flex';
            return new Promise(resolve => {
                resolveModalPromise = resolve;
            });
        }

        /**
         * Handles the confirmation of the price modal.
         */
        modalConfirmBtn.onclick = () => {
            const price = parseFloat(modalPriceInput.value);
            priceModal.style.display = 'none';
            resolveModalPromise(price);
        };

        /**
         * Handles the cancellation of the price modal.
         */
        modalCancelBtn.onclick = () => {
            priceModal.style.display = 'none';
            resolveModalPromise(null); // Resolve with null if canceled
        };

        /**
         * Updates the user's balance and wallet display based on the active wallet type.
         */
        function updateDisplay() {
            userIdDisplay.textContent = currentUserId;
            displayNameInput.value = displayName;

            if (activeWalletType === 'firebase') {
                activeWalletDisplay.textContent = `Firebase Account`;
                userBalanceDisplay.textContent = `${userBalance.toFixed(2)} XFI`;
            } else { // simulated
                activeWalletDisplay.textContent = `Simulated Wallet: ${simulatedWalletAddress.substring(0, 10)}...${simulatedWalletAddress.substring(simulatedWalletAddress.length - 8)}`;
                userBalanceDisplay.textContent = `${simulatedWalletBalance.toFixed(2)} XFI (Simulated)`;
            }
        }

        /**
         * Initializes Firebase and authenticates the user.
         */
        async function initializeFirebase() {
            try {
                toggleLoading(true);
                app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);

                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        currentUserId = user.uid;
                        console.log("Authenticated with user ID:", currentUserId);

                        // Listen for user data (display name and balance)
                        const userDataDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'user_data', 'profile');
                        onSnapshot(userDataDocRef, async (docSnap) => {
                            if (docSnap.exists()) {
                                const data = docSnap.data();
                                displayName = data.displayName || "Anonymous";
                                userBalance = data.balance || 1000; // Default if not set
                                console.log("User data fetched:", data);
                            } else {
                                // Initialize display name and balance if document doesn't exist
                                displayName = "Anonymous";
                                userBalance = 1000;
                                await setDoc(userDataDocRef, { displayName: displayName, balance: userBalance });
                                console.log("User profile initialized.");
                            }
                            updateDisplay(); // Update UI after fetching user data
                        }, (error) => {
                            console.error("Error listening to user data:", error);
                            showMessage("Failed to load user profile.", true);
                        });

                        // Listen for NFT changes (marketplace and user's NFTs)
                        const nftsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'nfts');
                        onSnapshot(nftsCollectionRef, (snapshot) => {
                            nfts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            console.log("NFTs fetched:", nfts);
                            renderAllNfts(); // Re-render all NFTs when data changes
                        }, (error) => {
                            console.error("Error listening to NFTs:", error);
                            showMessage("Failed to load NFTs.", true);
                        });

                    } else {
                        // Sign in anonymously if no initial token or user not authenticated
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    }
                    toggleLoading(false);
                });
            } catch (error) {
                console.error("Error initializing Firebase or authenticating:", error);
                showMessage("Failed to initialize app. Please try again.", true);
                toggleLoading(false);
            }
        }

        /**
         * Handles saving the user's display name.
         */
        async function saveDisplayName() {
            const newDisplayName = displayNameInput.value.trim();
            if (!newDisplayName) {
                showMessage("Display name cannot be empty.", true);
                return;
            }
            if (newDisplayName === displayName) {
                showMessage("Display name is already saved.", false);
                return;
            }

            toggleLoading(true);
            try {
                const userDataDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'user_data', 'profile');
                await updateDoc(userDataDocRef, { displayName: newDisplayName });
                displayName = newDisplayName; // Update local state
                updateDisplay(); // Update UI
                showMessage("Display name saved successfully!");
            } catch (error) {
                console.error("Error saving display name:", error);
                showMessage("Failed to save display name.", true);
            } finally {
                toggleLoading(false);
            }
        }

        /**
         * Generates a random hexadecimal string to simulate a wallet address.
         * @param {number} length - The desired length of the address (e.g., 40 for Ethereum-like).
         * @returns {string} A simulated wallet address.
         */
        function generateSimulatedWalletAddress(length = 40) {
            let result = '0x';
            const characters = 'abcdef0123456789';
            const charactersLength = characters.length;
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            return result;
        }

        /**
         * Connects a simulated wallet, generating a random address and balance.
         */
        async function connectSimulatedWallet() {
            toggleLoading(true);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate connection delay

            simulatedWalletAddress = generateSimulatedWalletAddress();
            simulatedWalletBalance = Math.floor(Math.random() * 5000) + 500; // Random balance between 500 and 5500

            activeWalletType = 'simulated';
            updateDisplay();
            showMessage(`Connected simulated wallet: ${simulatedWalletAddress.substring(0, 10)}...`);
            toggleLoading(false);
        }

        /**
         * Switches back to using the Firebase-managed balance.
         */
        function useFirebaseWallet() {
            activeWalletType = 'firebase';
            updateDisplay();
            showMessage("Switched to Firebase account balance.");
        }

        /**
         * Renders all NFTs into their respective containers based on currentUserId.
         */
        function renderAllNfts() {
            const yourNfts = nfts.filter(nft => nft.owner === currentUserId);
            const marketplaceNfts = nfts.filter(nft => nft.isListed && nft.owner !== currentUserId);

            renderNfts(yourNfts, yourNftsContainer, true);
            renderNfts(marketplaceNfts, marketplaceContainer, false);
        }

        /**
         * Renders the NFTs in the specified container.
         * @param {Array} nftList - The list of NFTs to render.
         * @param {HTMLElement} containerElement - The DOM element to render NFTs into.
         * @param {boolean} isYourNfts - True if rendering user's NFTs, false for marketplace.
         */
        function renderNfts(nftList, containerElement, isYourNfts) {
            containerElement.innerHTML = ''; // Clear existing NFTs

            if (nftList.length === 0) {
                const currentMessageElement = isYourNfts ? noYourNftsMessage : noMarketplaceNftsMessage;
                if (!containerElement.contains(currentMessageElement)) {
                    containerElement.appendChild(currentMessageElement);
                }
                currentMessageElement.style.display = 'block';
                return;
            } else {
                const currentMessageElement = isYourNfts ? noYourNftsMessage : noMarketplaceNftsMessage;
                currentMessageElement.style.display = 'none'; // Hide message if NFTs exist
            }

            nftList.forEach(nft => {
                const nftCard = document.createElement('div');
                nftCard.className = 'nft-card p-4 rounded-lg flex flex-col justify-between';
                nftCard.innerHTML = `
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">${nft.name}</h3>
                    <p class="text-gray-600 text-sm mb-3">${nft.description}</p>
                    <div class="flex-grow flex items-center justify-center bg-gray-100 rounded-md mb-3 h-32">
                        <img src="${nft.imageUrl}" alt="${nft.name}" class="max-h-full max-w-full object-contain rounded-md">
                    </div>
                    <p class="text-gray-700 font-medium mb-1">Owner: <span class="font-mono text-xs">${nft.owner.substring(0, 8)}...${nft.owner.substring(nft.owner.length - 4)}</span></p>
                    ${nft.isListed ? `<p class="text-green-600 font-bold text-lg mb-3">Price: ${nft.price} XFI</p>` : ''}
                    <div class="mt-auto">
                        ${isYourNfts && !nft.isListed ? `<button class="btn-primary w-full mb-2 list-btn" data-id="${nft.id}">List for Sale</button>` : ''}
                        ${!isYourNfts && nft.isListed && nft.owner !== currentUserId ? `<button class="btn-primary w-full buy-btn" data-id="${nft.id}" data-price="${nft.price}">Buy NFT</button>` : ''}
                        ${isYourNfts && nft.isListed ? `<button class="btn-secondary w-full delist-btn" data-id="${nft.id}">Delist</button>` : ''}
                    </div>
                `;
                containerElement.appendChild(nftCard);
            });

            // Add event listeners for new buttons
            containerElement.querySelectorAll('.list-btn').forEach(button => {
                button.onclick = (e) => listNft(e.target.dataset.id);
            });
            containerElement.querySelectorAll('.buy-btn').forEach(button => {
                button.onclick = (e) => buyNft(e.target.dataset.id, parseFloat(e.target.dataset.price));
            });
            containerElement.querySelectorAll('.delist-btn').forEach(button => {
                button.onclick = (e) => delistNft(e.target.dataset.id);
            });
        }

        /**
         * Generates a placeholder image URL.
         * @param {string} text - Text to display on the image.
         * @returns {string} The placeholder image URL.
         */
        function getPlaceholderImage(text) {
            const width = 200;
            const height = 200;
            const bgColor = 'cccccc';
            const textColor = '333333';
            return `https://placehold.co/${width}x${height}/${bgColor}/${textColor}?text=${encodeURIComponent(text)}`;
        }


        /**
         * Handles the minting of a new NFT.
         */
        async function mintNft() {
            const name = nftNameInput.value.trim();
            const description = nftDescriptionInput.value.trim();

            if (!name || !description) {
                showMessage("Please enter both NFT Name and Description.", true);
                return;
            }

            toggleLoading(true);
            try {
                const newNft = {
                    name,
                    description,
                    owner: currentUserId,
                    isListed: false,
                    price: 0,
                    imageUrl: getPlaceholderImage(name), // Generate a placeholder image
                    createdAt: new Date() // Add a timestamp
                };

                // Add NFT to Firestore
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'nfts'), newNft);

                nftNameInput.value = '';
                nftDescriptionInput.value = '';
                showMessage("NFT minted successfully!");
            } catch (error) {
                console.error("Error minting NFT:", error);
                showMessage("Failed to mint NFT. Please try again.", true);
            } finally {
                toggleLoading(false);
            }
        }

        /**
         * Handles listing an NFT for sale.
         * @param {string} nftId - The ID of the NFT to list.
         */
        async function listNft(nftId) {
            const nft = nfts.find(n => n.id === nftId && n.owner === currentUserId);
            if (!nft) {
                showMessage("NFT not found or you are not the owner.", true);
                return;
            }

            const price = await showPriceModal(); // Use the custom modal
            if (price === null || isNaN(price) || price <= 0) {
                showMessage("Invalid price. Please enter a positive number.", true);
                return;
            }

            toggleLoading(true);
            try {
                const nftDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'nfts', nftId);
                await updateDoc(nftDocRef, {
                    isListed: true,
                    price: price
                });
                showMessage(`NFT "${nft.name}" listed for ${price} XFI.`);
            } catch (error) {
                console.error("Error listing NFT:", error);
                showMessage("Failed to list NFT. Please try again.", true);
            } finally {
                toggleLoading(false);
            }
        }

        /**
         * Handles delisting an NFT.
         * @param {string} nftId - The ID of the NFT to delist.
         */
        async function delistNft(nftId) {
            const nft = nfts.find(n => n.id === nftId && n.owner === currentUserId);
            if (!nft) {
                showMessage("NFT not found or you are not the owner.", true);
                return;
            }

            toggleLoading(true);
            try {
                const nftDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'nfts', nftId);
                await updateDoc(nftDocRef, {
                    isListed: false,
                    price: 0
                });
                showMessage(`NFT "${nft.name}" delisted.`);
            } catch (error) {
                console.error("Error delisting NFT:", error);
                showMessage("Failed to delist NFT. Please try again.", true);
            } finally {
                toggleLoading(false);
            }
        }

        /**
         * Handles buying an NFT from the marketplace.
         * @param {string} nftId - The ID of the NFT to buy.
         * @param {number} price - The price of the NFT.
         */
        async function buyNft(nftId, price) {
            const nft = nfts.find(n => n.id === nftId && n.isListed && nft.owner !== currentUserId);
            if (!nft) {
                showMessage("NFT not found or not available for purchase.", true);
                return;
            }

            let currentActiveBalance = activeWalletType === 'firebase' ? userBalance : simulatedWalletBalance;

            if (currentActiveBalance < price) {
                showMessage("Insufficient XFI balance to purchase this NFT.", true);
                return;
            }

            toggleLoading(true);
            try {
                // Deduct from buyer's active balance
                if (activeWalletType === 'firebase') {
                    const buyerBalanceDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'user_data', 'profile');
                    await updateDoc(buyerBalanceDocRef, {
                        balance: userBalance - price
                    });
                } else { // simulated
                    simulatedWalletBalance -= price;
                }

                // Update seller's balance (if seller exists and is not anonymous)
                if (nft.owner) {
                    const sellerProfileDocRef = doc(db, 'artifacts', appId, 'users', nft.owner, 'user_data', 'profile');
                    const sellerDocSnap = await getDoc(sellerProfileDocRef);
                    if (sellerDocSnap.exists()) {
                        await updateDoc(sellerProfileDocRef, {
                            balance: sellerDocSnap.data().balance + price
                        });
                    } else {
                        // If seller's profile document doesn't exist, create it with new balance
                        await setDoc(sellerProfileDocRef, { displayName: "Anonymous", balance: price });
                    }
                }

                // Update NFT ownership and status
                const nftDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'nfts', nftId);
                await updateDoc(nftDocRef, {
                    owner: currentUserId,
                    isListed: false,
                    price: 0
                });

                updateDisplay(); // Update UI with new balance
                showMessage(`Successfully purchased "${nft.name}" for ${price} XFI!`);
            } catch (error) {
                console.error("Error buying NFT:", error);
                showMessage("Failed to purchase NFT. Please try again.", true);
            } finally {
                toggleLoading(false);
            }
        }

        // Event Listeners
        mintNftBtn.addEventListener('click', mintNft);
        saveDisplayNameBtn.addEventListener('click', saveDisplayName);
        connectSimulatedWalletBtn.addEventListener('click', connectSimulatedWallet);
        useFirebaseWalletBtn.addEventListener('click', useFirebaseWallet);

        // Initialize the application when the window loads
        window.onload = initializeFirebase;