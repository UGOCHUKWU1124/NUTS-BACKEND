import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CreatorRequestUser = {
  id: string;
  email: string;
  type: 'creator';
  refreshId?: string;
};

export const GetCreator = createParamDecorator(
  (data: keyof CreatorRequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CreatorRequestUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
