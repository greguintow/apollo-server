import { GraphQLError } from 'graphql';

import {
  ApolloError,
  formatApolloErrors,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  UserInputError,
  SyntaxError,
} from 'apollo-server-errors';

describe('Errors', () => {
  describe('ApolloError', () => {
    const message = 'message';
    it('defaults code to INTERNAL_SERVER_ERROR', () => {
      const error = new ApolloError(message);
      expect(error.message).toEqual(message);
      expect(error.extensions.code).toBeUndefined();
    });
    it('allows code setting and additional properties', () => {
      const code = 'CODE';
      const key = 'value';
      const error = new ApolloError(message, code, { key });
      expect(error.message).toEqual(message);
      expect(error.key).toBeUndefined();
      expect(error.extensions.code).toEqual(code);
      expect(error.extensions.key).toEqual(key);
    });
  });

  describe('formatApolloErrors', () => {
    type CreateFormatError =
      | ((
          options: Record<string, any>,
          errors: Error[],
        ) => Promise<Record<string, any>[]>)
      | ((options?: Record<string, any>) => Promise<Record<string, any>>);
    const message = 'message';
    const code = 'CODE';
    const key = 'value';

    const createFormattedError: CreateFormatError = async (
      options?: Record<string, any>,
      errors?: Error[],
    ) => {
      if (errors === undefined) {
        const error = new ApolloError(message, code, { key });
        return (
          await formatApolloErrors(
            [
              new GraphQLError(
                error.message,
                undefined,
                undefined,
                undefined,
                undefined,
                error,
              ),
            ],
            options,
          )
        )[0];
      } else {
        return formatApolloErrors(errors, options);
      }
    };

    it('exposes a stacktrace in debug mode', async () => {
      const error = await createFormattedError({ debug: true });
      expect(error.message).toEqual(message);
      expect(error.extensions.key).toEqual(key);
      expect(error.extensions.exception.key).toBeUndefined();
      expect(error.extensions.code).toEqual(code);
      // stacktrace should exist under exception
      expect(error.extensions.exception.stacktrace).toBeDefined();
    });
    it('hides stacktrace by default', async () => {
      const thrown = new Error(message);
      (thrown as any).key = key;
      const error = (
        await formatApolloErrors([
          new GraphQLError(
            thrown.message,
            undefined,
            undefined,
            undefined,
            undefined,
            thrown,
          ),
        ])
      )[0];
      expect(error.message).toEqual(message);
      expect(error.extensions.code).toEqual('INTERNAL_SERVER_ERROR');
      expect(error.extensions.exception.key).toEqual(key);
      // stacktrace should exist under exception
      expect(error.extensions.exception.stacktrace).toBeUndefined();
    });
    it('exposes fields on error under exception field and provides code', async () => {
      const error = await createFormattedError();
      expect(error.message).toEqual(message);
      expect(error.extensions.key).toEqual(key);
      expect(error.extensions.exception).toBeUndefined();
      expect(error.extensions.code).toEqual(code);
    });
    it('calls formatter after exposing the code and stacktrace', async () => {
      const error = new ApolloError(message, code, { key });
      const formatter = jest.fn();
      await formatApolloErrors([error], {
        formatter,
        debug: true,
      });
      expect(error.message).toEqual(message);
      expect(error.extensions.key).toEqual(key);
      expect(error.key).toBeUndefined();
      expect(error.extensions.code).toEqual(code);
      expect(error instanceof ApolloError).toBe(true);
      expect(formatter).toHaveBeenCalledTimes(1);
    });
    it('Formats native Errors in a JSON-compatible way', async () => {
      const error = new Error('Hello');
      const [formattedError] = await formatApolloErrors([error]);
      expect(JSON.parse(JSON.stringify(formattedError)).message).toBe('Hello');
    });
  });
  describe('Named Errors', () => {
    const message = 'message';
    function verifyError(
      error: ApolloError,
      {
        code,
        errorClass,
        name,
      }: { code: string; errorClass: any; name: string },
    ) {
      expect(error.message).toEqual(message);
      expect(error.extensions.code).toEqual(code);
      expect(error.name).toEqual(name);
      expect(error instanceof ApolloError).toBe(true);
      expect(error instanceof errorClass).toBe(true);
    }

    it('provides an authentication error', () => {
      verifyError(new AuthenticationError(message), {
        code: 'UNAUTHENTICATED',
        errorClass: AuthenticationError,
        name: 'AuthenticationError',
      });
    });
    it('provides a forbidden error', () => {
      verifyError(new ForbiddenError(message), {
        code: 'FORBIDDEN',
        errorClass: ForbiddenError,
        name: 'ForbiddenError',
      });
    });
    it('provides a syntax error', () => {
      verifyError(new SyntaxError(message), {
        code: 'GRAPHQL_PARSE_FAILED',
        errorClass: SyntaxError,
        name: 'SyntaxError',
      });
    });
    it('provides a validation error', () => {
      verifyError(new ValidationError(message), {
        code: 'GRAPHQL_VALIDATION_FAILED',
        errorClass: ValidationError,
        name: 'ValidationError',
      });
    });
    it('provides a user input error', async () => {
      const error = new UserInputError(message, {
        field1: 'property1',
        field2: 'property2',
      });
      verifyError(error, {
        code: 'BAD_USER_INPUT',
        errorClass: UserInputError,
        name: 'UserInputError',
      });

      const formattedError = (
        await formatApolloErrors([
          new GraphQLError(
            error.message,
            undefined,
            undefined,
            undefined,
            undefined,
            error,
          ),
        ])
      )[0];

      expect(formattedError.extensions.field1).toEqual('property1');
      expect(formattedError.extensions.field2).toEqual('property2');
      expect(formattedError.extensions.exception).toBeUndefined();
    });
  });
});
