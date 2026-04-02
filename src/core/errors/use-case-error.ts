export abstract class UseCaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
