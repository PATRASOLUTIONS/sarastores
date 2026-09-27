declare module "bcryptjs" {
  interface Bcrypt {
    compare(value: string, hash: string): Promise<boolean>
    hash(value: string, rounds: number): Promise<string>
  }

  const bcrypt: Bcrypt
  export default bcrypt
}