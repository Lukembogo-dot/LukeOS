// Strava API Types

export interface StravaActivity {
  id: number;
  name: string;
  type: string; // Run, Ride, Swim, Workout, etc.
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  start_date: string;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
}

export interface StravaSummary {
  totalActivities: number;
  totalDistance: number; // meters
  totalDuration: number; // seconds
  totalElevation: number; // meters
  totalCalories: number;
  activitiesByType: Record<string, number>;
}
