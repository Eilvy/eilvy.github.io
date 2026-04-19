export interface Friend {
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

export interface FriendsData {
  friends: Friend[];
}
