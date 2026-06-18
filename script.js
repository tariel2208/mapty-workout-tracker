'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #editingWorkout = null;
  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.style.display = 'grid';
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value =
      '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    let cadence, elevation;

    // ✅ EDIT MODE FIRST
    if (this.#editingWorkout) {
      const w = this.#editingWorkout;

      w.distance = distance;
      w.duration = duration;

      if (w.type === 'running') {
        cadence = +inputCadence.value;

        if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
          return alert('Invalid input');

        w.cadence = cadence;
        w.calcPace();
      }

      if (w.type === 'cycling') {
        elevation = +inputElevation.value;

        if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
          return alert('Invalid input');

        w.elevationGain = elevation;
        w.calcSpeed();
      }

      this._setLocalStorage();
      this.#editingWorkout = null;
      location.reload();
      return;
    }

    // ❗ NEW WORKOUT MODE (only now mapEvent is required)
    if (!this.#mapEvent) return;

    const { lat, lng } = this.#mapEvent.latlng;

    if (type === 'running') {
      cadence = +inputCadence.value;

      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return alert('Inputs must be positive');

      const workout = new Running([lat, lng], distance, duration, cadence);

      this.#workouts.push(workout);
      this._renderWorkoutMarker(workout);
      this._renderWorkout(workout);
    }

    if (type === 'cycling') {
      elevation = +inputElevation.value;

      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return alert('Inputs must be positive');

      const workout = new Cycling([lat, lng], distance, duration, elevation);

      this.#workouts.push(workout);
      this._renderWorkoutMarker(workout);
      this._renderWorkout(workout);
    }

    this._hideForm();
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <button class = "workout__edit">✏️</button>
        <button class="workout__delete">❌</button>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <button class = "workout__edit">✏️</button>
        <button class = "workout__delete">❌</button>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if(e.target.classList.contains('workout__delete')){
      this._deleteWorkout(workout.id);
      return;
    }
    if (e.target.classList.contains('workout__edit')) {
      this._editWorkout(workout);
      return;
    }

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });


    // using the public interface
    //workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data.map(work => {
    let workout;

    if (work.type === 'running') {
      workout = new Running(
        work.coords,
        work.distance,
        work.duration,
        work.cadence
      );
    }

    if (work.type === 'cycling') {
      workout = new Cycling(
        work.coords,
        work.distance,
        work.duration,
        work.elevationGain
      );
    }

    workout.id = work.id;
    workout.date = new Date(work.date);
    workout.clicks = work.clicks;

    return workout;
  });

  this.#workouts.forEach(work => {
    this._renderWorkout(work);
  });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _deleteWorkout(id) {
    this.#workouts = this.#workouts.filter(
      work => work.id !== id
    );

    this._setLocalStorage();
    location.reload();
  }

  _editWorkout(workout) {
  this.#editingWorkout = workout;

  // form show
  form.classList.remove('hidden');

  inputDistance.value = workout.distance;
  inputDuration.value = workout.duration;

  if (workout.type === 'running') {
    inputType.value = 'running';
    inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    inputElevation.closest('.form__row').classList.add('form__row--hidden');
    inputCadence.value = workout.cadence;
  }

  if (workout.type === 'cycling') {
    inputType.value = 'cycling';
    inputElevation.closest('.form__row').classList.remove('form__row--hidden');
    inputCadence.closest('.form__row').classList.add('form__row--hidden');
    inputElevation.value = workout.elevationGain;
  }
}
}

const app = new App();