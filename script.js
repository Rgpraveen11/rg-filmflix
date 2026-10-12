const TMDB_API_KEY = "d91776b608c3607a8f4a26aa850c7136";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#movieSearch");
const yearFilter = document.querySelector("#yearFilter");
const typeFilter = document.querySelector("#typeFilter");
const suggestions = document.querySelector("#suggestions");
const movieGrid = document.querySelector("#movieGrid");
const statusMessage = document.querySelector("#statusMessage");
const resultsTitle = document.querySelector("#resultsTitle");
const resultsCount = document.querySelector("#resultsCount");
const previousPage = document.querySelector("#previousPage");
const nextPage = document.querySelector("#nextPage");
const pageLabel = document.querySelector("#pageLabel");

const favoritesToggle = document.querySelector("#favoritesToggle");
const favoriteCount = document.querySelector("#favoriteCount");
const favoritesSection = document.querySelector("#favoritesSection");
const favoritesGrid = document.querySelector("#favoritesGrid");
const favoritesEmpty = document.querySelector("#favoritesEmpty");
const closeFavorites = document.querySelector("#closeFavorites");

const movieModal = document.querySelector("#movieModal");
const modalContent = document.querySelector("#modalContent");
const closeModal = document.querySelector("#closeModal");

let currentPage = 1;
let currentQuery = "";
let currentMovies = [];
let favorites = JSON.parse(localStorage.getItem("rgFilmFlixFavorites") || "[]");
let suggestionTimer;

async function tmdb(path, params = {}) {
  const url = new URL(`${TMDB_API_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}). Check your API key.`);
  }

  return response.json();
}

function getMediaType() {
  return typeFilter?.value === "series" ? "tv" : "movie";
}

function getYearParam() {
  const year = yearFilter?.value?.trim();
  if (!year) return {};

  return getMediaType() === "movie"
    ? { primary_release_year: year }
    : { first_air_date_year: year };
}

function showStatus(message) {
  if (statusMessage) statusMessage.textContent = message;
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleOf(movie) {
  return movie.title || movie.name || "Untitled";
}

function yearOf(movie) {
  const date = movie.release_date || movie.first_air_date || "";
  return date ? date.slice(0, 4) : "Year unknown";
}

function posterOf(movie) {
  return movie.poster_path
    ? `${IMAGE_URL}${movie.poster_path}`
    : "";
}

function isFavorite(movie) {
  return favorites.some(item => item.id === movie.id &&
    item.media_type === (movie.media_type || getMediaType()));
}

function renderMovies(movies) {
  if (!movieGrid) return;

  if (!movies.length) {
    movieGrid.innerHTML = "";
    showStatus("No results found. Try another title.");
    return;
  }

  showStatus("");

  movieGrid.innerHTML = movies.map(movie => {
    const type = movie.media_type || getMediaType();
    const title = safeText(titleOf(movie));
    const poster = posterOf(movie);
    const favorite = isFavorite(movie);

    return `
      <article class="movie-card">
        <button class="movie-poster-button"
          data-details-id="${movie.id}"
          data-details-type="${type}"
          aria-label="View details for ${title}">
          ${poster
            ? `<img src="${poster}" alt="${title} poster" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=&quot;poster-placeholder&quot;>Image failed to load</div>';"><div class="poster-placeholder">Image failed to load</div>`
            : `<div class="poster-placeholder">Image unavailable</div>`}
        </button>
        <div class="movie-card-content">
          <h3>${title}</h3>
          <p>${yearOf(movie)}</p>
          <p>⭐ ${Number(movie.vote_average || 0).toFixed(1)}/10</p>
          <div class="movie-actions">
            <button data-details-id="${movie.id}"
              data-details-type="${type}">Details</button>
            <button data-favorite-id="${movie.id}"
              data-favorite-type="${type}">
              ${favorite ? "♥ Saved" : "♡ Favorite"}
            </button>
          </div>
        </div>
      </article>`;
  }).join("");
}

async function searchMovies(page = 1) {
  const query = searchInput?.value.trim() || "";
  currentQuery = query;
  currentPage = page;

  if (!query) {
    showStatus("Enter a movie or TV title to search.");
    if (movieGrid) movieGrid.innerHTML = "";
    return;
  }

  showStatus("Searching TMDB...");
  if (movieGrid) movieGrid.innerHTML = "";

  try {
    const type = getMediaType();
    const data = await tmdb(`/search/${type}`, {
      query,
      page,
      include_adult: false,
      ...getYearParam()
    });

    currentMovies = data.results || [];
    renderMovies(currentMovies);

    if (resultsTitle) resultsTitle.textContent = `Results for "${query}"`;
    if (resultsCount) resultsCount.textContent = `${data.total_results || 0} results`;
    if (pageLabel) pageLabel.textContent = `Page ${data.page || page} of ${data.total_pages || 1}`;
    if (previousPage) previousPage.disabled = page <= 1;
    if (nextPage) nextPage.disabled = page >= Math.min(data.total_pages || 1, 500);

    if (!currentMovies.length) {
      showStatus("No results found. Try another title or filter.");
    }
  } catch (error) {
    showStatus(`${error.message} Verify your TMDB key and internet connection.`);
    console.error(error);
  }
}

searchForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (suggestions) suggestions.innerHTML = "";
  searchMovies(1);
});

yearFilter?.addEventListener("change", () => {
  if (currentQuery) searchMovies(1);
});

typeFilter?.addEventListener("change", () => {
  if (currentQuery) searchMovies(1);
});

previousPage?.addEventListener("click", () => {
  if (currentPage > 1) searchMovies(currentPage - 1);
});

nextPage?.addEventListener("click", () => {
  searchMovies(currentPage + 1);
});

searchInput?.addEventListener("input", () => {
  clearTimeout(suggestionTimer);

  const query = searchInput.value.trim();
  if (suggestions) suggestions.innerHTML = "";

  if (query.length < 2) return;

  suggestionTimer = setTimeout(async () => {
    try {
      const data = await tmdb(`/search/${getMediaType()}`, {
        query,
        include_adult: false,
        ...getYearParam()
      });

      if (!suggestions) return;

      suggestions.innerHTML = (data.results || []).slice(0, 5).map(movie => `
        <button type="button" class="suggestion-item"
          data-suggestion="${safeText(titleOf(movie))}">
          ${safeText(titleOf(movie))} (${yearOf(movie)})
        </button>
      `).join("");
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  }, 350);
});

suggestions?.addEventListener("click", event => {
  const button = event.target.closest("[data-suggestion]");
  if (!button) return;

  searchInput.value = button.dataset.suggestion;
  suggestions.innerHTML = "";
  searchMovies(1);
});

function saveFavorites() {
  localStorage.setItem("rgFilmFlixFavorites", JSON.stringify(favorites));
  if (favoriteCount) favoriteCount.textContent = favorites.length;
}

function renderFavorites() {
  if (!favoritesGrid) return;

  if (favoritesEmpty) {
    favoritesEmpty.hidden = favorites.length > 0;
  }

  favoritesGrid.innerHTML = favorites.map(movie => {
    const title = safeText(titleOf(movie));
    const poster = posterOf(movie);

    return `
      <article class="movie-card">
        ${poster
          ? `<img src="${poster}" alt="${title} poster" loading="lazy">`
          : `<div class="poster-placeholder">No poster available</div>`}
        <div class="movie-card-content">
          <h3>${title}</h3>
          <p>${yearOf(movie)}</p>
          <button data-remove-favorite="${movie.id}"
            data-favorite-type="${movie.media_type}">Remove favorite</button>
          <button data-details-id="${movie.id}"
            data-details-type="${movie.media_type}">Details</button>
        </div>
      </article>`;
  }).join("");
}

function toggleFavorite(movie) {
  const type = movie.media_type || getMediaType();
  const index = favorites.findIndex(item =>
    item.id === movie.id && item.media_type === type
  );

  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ ...movie, media_type: type });
  }

  saveFavorites();
  renderFavorites();
  renderMovies(currentMovies);
}

movieGrid?.addEventListener("click", async event => {
  const favoriteButton = event.target.closest("[data-favorite-id]");
  if (favoriteButton) {
    const id = Number(favoriteButton.dataset.favoriteId);
    const type = favoriteButton.dataset.favoriteType;
    const movie = currentMovies.find(item => item.id === id);

    if (movie) toggleFavorite({ ...movie, media_type: type });
    return;
  }

  const detailsButton = event.target.closest("[data-details-id]");
  if (detailsButton) {
    openDetails(detailsButton.dataset.detailsId, detailsButton.dataset.detailsType);
  }
});

favoritesGrid?.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-remove-favorite]");
  if (removeButton) {
    const id = Number(removeButton.dataset.removeFavorite);
    const type = removeButton.dataset.favoriteType;
    favorites = favorites.filter(item =>
      !(item.id === id && item.media_type === type)
    );
    saveFavorites();
    renderFavorites();
    renderMovies(currentMovies);
    return;
  }

  const detailsButton = event.target.closest("[data-details-id]");
  if (detailsButton) {
    openDetails(detailsButton.dataset.detailsId, detailsButton.dataset.detailsType);
  }
});

favoritesToggle?.addEventListener("click", () => {
  if (favoritesSection) favoritesSection.hidden = !favoritesSection.hidden;
  renderFavorites();
});

closeFavorites?.addEventListener("click", () => {
  if (favoritesSection) favoritesSection.hidden = true;
});

async function openDetails(id, type = "movie") {
  if (!movieModal || !modalContent) return;

  movieModal.hidden = false;
  modalContent.innerHTML = "<p>Loading movie details...</p>";

  try {
    const movie = await tmdb(`/${type}/${id}`, {
      append_to_response: "credits"
    });

    const title = safeText(titleOf(movie));
    const poster = posterOf(movie);
    const overview = safeText(movie.overview || "No plot summary available.");
    const director = (movie.credits?.crew || [])
      .filter(person => person.job === "Director")
      .map(person => safeText(person.name))
      .join(", ") || "Not available";
    const cast = (movie.credits?.cast || [])
      .slice(0, 6)
      .map(person => safeText(person.name))
      .join(", ") || "Not available";

    modalContent.innerHTML = `
      <h2>${title}</h2>
      ${poster ? `<img class="modal-poster" src="${poster}" alt="${title} poster">` : ""}
      <p><strong>Release date:</strong> ${safeText(movie.release_date || movie.first_air_date || "Unknown")}</p>
      <p><strong>Rating:</strong> ⭐ ${Number(movie.vote_average || 0).toFixed(1)}/10</p>
      <p><strong>Director:</strong> ${director}</p>
      <p><strong>Cast:</strong> ${cast}</p>
      <p><strong>Overview:</strong> ${overview}</p>`;
  } catch (error) {
    modalContent.innerHTML = `<p>${safeText(error.message)}</p>`;
  }
}

closeModal?.addEventListener("click", () => {
  movieModal.hidden = true;
});

movieModal?.addEventListener("click", event => {
  if (event.target === movieModal) movieModal.hidden = true;
});

saveFavorites();
renderFavorites();

if (previousPage) previousPage.disabled = true;
if (nextPage) nextPage.disabled = true;
showStatus("Search for a movie to get started.");